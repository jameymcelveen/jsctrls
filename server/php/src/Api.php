<?php

declare(strict_types=1);

namespace Names;

use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Psr\Http\Server\RequestHandlerInterface as Handler;
use Slim\App;
use Slim\Factory\AppFactory;
use Slim\Routing\RouteCollectorProxy;

/** The jsctrls demo names API (specs/006-names-api) in PHP, with Slim 4. */
final class Api
{
    private const ORIGINS = ['http://localhost:5173', 'http://127.0.0.1:5173'];

    public static function create(NameStore $store, int $delayMs = 300): App
    {
        $app = AppFactory::create();
        $app->addRoutingMiddleware();
        $app->addErrorMiddleware(false, false, false);

        // CORS for the Vite dev origins, including preflight.
        $app->add(function (Request $request, Handler $handler): Response {
            $origin = $request->getHeaderLine('Origin');
            $response = $request->getMethod() === 'OPTIONS'
                ? (new \Slim\Psr7\Response())->withStatus(204)
                : $handler->handle($request);
            if (in_array($origin, self::ORIGINS, true)) {
                $response = $response
                    ->withHeader('Access-Control-Allow-Origin', $origin)
                    ->withAddedHeader('Vary', 'Origin')
                    ->withHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE')
                    ->withHeader('Access-Control-Allow-Headers', 'Content-Type');
            }
            return $response;
        });

        $app->get('/actuator/health', fn (Request $q, Response $r) => self::json($r, ['status' => 'UP']));

        $app->group('/api/names', function (RouteCollectorProxy $names) use ($store): void {
            $names->get('', fn (Request $q, Response $r) => self::json($r, $store->list()));

            $names->get('/{id}', function (Request $q, Response $r, array $args) use ($store): Response {
                $found = $store->get($args['id']);
                return $found ? self::json($r, $found) : self::notFound($r, $args['id']);
            });

            $names->post('', function (Request $q, Response $r) use ($store): Response {
                $name = self::readName($q);
                if ($name instanceof \Closure) {
                    return $name($r);
                }
                $created = $store->create($name);
                return self::json($r->withHeader('Location', "/api/names/{$created['id']}"), $created, 201);
            });

            $names->patch('/{id}', function (Request $q, Response $r, array $args) use ($store): Response {
                if ($store->get($args['id']) === null) {
                    return self::notFound($r, $args['id']);
                }
                $name = self::readName($q);
                if ($name instanceof \Closure) {
                    return $name($r);
                }
                $updated = $store->update($args['id'], $name);
                return $updated ? self::json($r, $updated) : self::notFound($r, $args['id']);
            });

            $names->delete('/{id}', function (Request $q, Response $r, array $args) use ($store): Response {
                return $store->delete($args['id']) ? $r->withStatus(204) : self::notFound($r, $args['id']);
            });
        })->add(function (Request $request, Handler $handler) use ($delayMs): Response {
            if ($delayMs > 0) {
                usleep($delayMs * 1000);
            }
            return $handler->handle($request);
        });

        return $app;
    }

    /** The trimmed name, or a closure that writes the 400 problem. */
    private static function readName(Request $request): string|\Closure
    {
        $body = json_decode((string) $request->getBody(), true);
        $raw = is_array($body) ? ($body['name'] ?? null) : null;
        if (!is_string($raw) || trim($raw) === '') {
            return fn (Response $r) => self::problem($r, 400, 'name: must not be blank');
        }
        if (mb_strlen($raw) > 100) {
            return fn (Response $r) => self::problem($r, 400, 'name: size must be between 0 and 100');
        }
        return trim($raw);
    }

    private static function json(Response $response, mixed $data, int $status = 200): Response
    {
        $response->getBody()->write(json_encode($data, JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES));
        return $response->withStatus($status)->withHeader('Content-Type', 'application/json');
    }

    /** An RFC 9457 problem detail. */
    private static function problem(Response $response, int $status, string $detail): Response
    {
        $title = $status === 400 ? 'Bad Request' : 'Not Found';
        $response->getBody()->write(json_encode(
            ['type' => 'about:blank', 'title' => $title, 'status' => $status, 'detail' => $detail],
            JSON_THROW_ON_ERROR,
        ));
        return $response->withStatus($status)->withHeader('Content-Type', 'application/problem+json');
    }

    private static function notFound(Response $response, string $id): Response
    {
        return self::problem($response, 404, "Name not found: {$id}");
    }
}
