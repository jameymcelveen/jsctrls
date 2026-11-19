<?php

declare(strict_types=1);

namespace Names\Tests;

use Names\Api;
use Names\NameStore;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use Psr\Http\Message\ResponseInterface;
use Slim\App;
use Slim\Psr7\Factory\ServerRequestFactory;
use Slim\Psr7\Factory\StreamFactory;

final class ApiTest extends TestCase
{
    private App $app;
    private string $path;

    protected function setUp(): void
    {
        $this->path = tempnam(sys_get_temp_dir(), 'names');
        unlink($this->path);
        $this->app = Api::create(new NameStore($this->path), 0);
    }

    protected function tearDown(): void
    {
        @unlink($this->path);
        @unlink($this->path . '.lock');
    }

    private function call(string $method, string $path, ?string $body = null): ResponseInterface
    {
        $request = (new ServerRequestFactory())->createServerRequest($method, $path);
        if ($body !== null) {
            $request = $request
                ->withHeader('Content-Type', 'application/json')
                ->withBody((new StreamFactory())->createStream($body));
        }
        return $this->app->handle($request);
    }

    private static function json(ResponseInterface $response): mixed
    {
        return json_decode((string) $response->getBody(), true);
    }

    public function testListsTheSeededNamesInIdOrder(): void
    {
        $response = $this->call('GET', '/api/names');
        self::assertSame(200, $response->getStatusCode());
        self::assertSame(
            [['id' => '1', 'name' => 'Ada'], ['id' => '2', 'name' => 'Grace'], ['id' => '3', 'name' => 'Katherine']],
            self::json($response),
        );
    }

    public function testCreatesATrimmedNameWithALocation(): void
    {
        $response = $this->call('POST', '/api/names', '{"name":"  Iris  "}');
        self::assertSame(201, $response->getStatusCode());
        self::assertSame('/api/names/4', $response->getHeaderLine('Location'));
        self::assertSame(['id' => '4', 'name' => 'Iris'], self::json($response));
    }

    public function testStateSurvivesANewAppOnTheSameFile(): void
    {
        $this->call('POST', '/api/names', '{"name":"Iris"}');
        $next = Api::create(new NameStore($this->path), 0);
        $request = (new ServerRequestFactory())->createServerRequest('GET', '/api/names/4');
        self::assertSame(200, $next->handle($request)->getStatusCode());
    }

    /** @return array<string, array{string}> */
    public static function invalidBodies(): array
    {
        return [
            'blank' => ['{"name":"   "}'],
            'missing' => ['{}'],
            'too long' => ['{"name":"' . str_repeat('a', 101) . '"}'],
            'not json' => ['not json'],
            'not a string' => ['{"name":7}'],
        ];
    }

    #[DataProvider('invalidBodies')]
    public function testInvalidNamesAre400Problems(string $body): void
    {
        $response = $this->call('POST', '/api/names', $body);
        self::assertSame(400, $response->getStatusCode());
        self::assertStringStartsWith('application/problem+json', $response->getHeaderLine('Content-Type'));
    }

    public function testMissingIdsAre404Problems(): void
    {
        foreach (['GET', 'PATCH', 'DELETE'] as $method) {
            $response = $this->call($method, '/api/names/missing', '{"name":"Ada"}');
            self::assertSame(404, $response->getStatusCode(), $method);
            self::assertSame('Name not found: missing', self::json($response)['detail']);
        }
    }

    public function testIdsSortNumerically(): void
    {
        for ($i = 0; $i < 7; $i++) {
            $this->call('POST', '/api/names', '{"name":"x"}');
        }
        $names = self::json($this->call('GET', '/api/names'));
        self::assertSame('10', end($names)['id']);
    }
}
