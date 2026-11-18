import { ConnectorError } from "./connectorError";
import type { Connector, Query } from "./types";

/** In-memory connector for tests. `create` assigns a new id. */
export function memoryConnector<T extends { id: string }>(rows: readonly T[]): Connector<T> {
  const stored = rows.map((row) => structuredClone(row));

  return {
    async list(query?: Query) {
      throwIfAborted(query?.signal);
      return stored.map((row) => structuredClone(row));
    },

    async get(id) {
      const found = stored.find((row) => row.id === id);
      if (!found) {
        throw new ConnectorError(404, `Not found: ${id}`);
      }
      return structuredClone(found);
    },

    async create(item) {
      const created = { ...item, id: crypto.randomUUID() } as T;
      stored.push(created);
      return structuredClone(created);
    },

    async update(id, item) {
      const index = stored.findIndex((row) => row.id === id);
      if (index < 0) {
        throw new ConnectorError(404, `Not found: ${id}`);
      }
      const current = stored[index];
      if (!current) {
        throw new ConnectorError(404, `Not found: ${id}`);
      }
      const updated = { ...current, ...item, id } as T;
      stored[index] = updated;
      return structuredClone(updated);
    },

    async remove(id) {
      const index = stored.findIndex((row) => row.id === id);
      if (index < 0) {
        throw new ConnectorError(404, `Not found: ${id}`);
      }
      stored.splice(index, 1);
    },
  };
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (!signal?.aborted) {
    return;
  }
  if (signal.reason instanceof Error) {
    throw signal.reason;
  }
  throw new DOMException("The operation was aborted.", "AbortError");
}
