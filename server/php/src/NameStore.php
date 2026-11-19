<?php

declare(strict_types=1);

namespace Names;

/**
 * The names store, kept in a JSON file.
 *
 * PHP shares nothing between requests, so the in-memory store the other
 * servers use cannot work here. A small file guarded by an exclusive lock
 * is the plainest shared state that needs no extension. The file is
 * seeded with Ada, Grace and Katherine the first time it is used.
 */
final class NameStore
{
    public function __construct(private readonly string $path)
    {
    }

    /** @return list<array{id: string, name: string}> */
    public function list(): array
    {
        $names = array_values($this->read(fn (array $state) => $state)['names']);
        usort($names, static function (array $a, array $b): int {
            if (ctype_digit($a['id']) && ctype_digit($b['id'])) {
                return (int) $a['id'] <=> (int) $b['id'];
            }
            return strcmp($a['id'], $b['id']);
        });
        return $names;
    }

    /** @return array{id: string, name: string}|null */
    public function get(string $id): ?array
    {
        return $this->read(fn (array $state) => $state)['names'][$id] ?? null;
    }

    /** @return array{id: string, name: string} */
    public function create(string $name): array
    {
        return $this->write(function (array &$state) use ($name): array {
            $created = ['id' => (string) $state['nextId'], 'name' => $name];
            $state['nextId']++;
            $state['names'][$created['id']] = $created;
            return $created;
        });
    }

    /** @return array{id: string, name: string}|null */
    public function update(string $id, string $name): ?array
    {
        return $this->write(function (array &$state) use ($id, $name): ?array {
            if (!isset($state['names'][$id])) {
                return null;
            }
            $state['names'][$id]['name'] = $name;
            return $state['names'][$id];
        });
    }

    public function delete(string $id): bool
    {
        return $this->write(function (array &$state) use ($id): bool {
            if (!isset($state['names'][$id])) {
                return false;
            }
            unset($state['names'][$id]);
            return true;
        });
    }

    private function read(callable $use): array
    {
        return $this->locked(LOCK_SH, fn (array $state) => $use($state));
    }

    private function write(callable $change): mixed
    {
        return $this->locked(LOCK_EX, function (array $state) use ($change): array {
            $result = $change($state);
            file_put_contents($this->path, json_encode($state, JSON_THROW_ON_ERROR));
            return [$result];
        }, true);
    }

    private function locked(int $mode, callable $body, bool $unwrap = false): mixed
    {
        $lock = fopen($this->path . '.lock', 'c');
        if ($lock === false) {
            throw new \RuntimeException("Cannot open lock file for {$this->path}");
        }
        try {
            flock($lock, LOCK_EX);
            if (!is_file($this->path)) {
                $seed = ['nextId' => 1, 'names' => []];
                foreach (['Ada', 'Grace', 'Katherine'] as $name) {
                    $seed['names'][(string) $seed['nextId']] = ['id' => (string) $seed['nextId'], 'name' => $name];
                    $seed['nextId']++;
                }
                file_put_contents($this->path, json_encode($seed, JSON_THROW_ON_ERROR));
            }
            $state = json_decode((string) file_get_contents($this->path), true, 512, JSON_THROW_ON_ERROR);
            $result = $body($state);
            return $unwrap ? $result[0] : $result;
        } finally {
            flock($lock, LOCK_UN);
            fclose($lock);
        }
    }
}
