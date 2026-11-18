import { ConnectorError } from "./connectorError";
import type { Connector, Query } from "./types";

export interface RestConnectorOptions {
  baseUrl: string;
  resource: string;
  /** JSON field that holds the record id. */
  key?: string;
}

/** `fetch` CRUD against a JSON collection. Throws `ConnectorError` on non-2xx. */
export function restConnector<T extends { id: string }, K extends string = string>(
  options: RestConnectorOptions,
): Connector<T, K> {
  const key = options.key ?? "id";
  const collection = joinUrl(options.baseUrl, options.resource);

  return {
    async list(query?: Query) {
      const body = await request(collection, {
        method: "GET",
        ...(query?.signal ? { signal: query.signal } : {}),
      });
      if (!Array.isArray(body)) {
        throw new ConnectorError(502, "List response was not an array");
      }
      return body.map((row) => readRecord(row, key));
    },

    async get(id) {
      return readRecord(await request(resourceUrl(collection, id), { method: "GET" }), key);
    },

    async create(item) {
      return readRecord(
        await request(collection, { method: "POST", body: JSON.stringify(item) }),
        key,
      );
    },

    async update(id, item) {
      return readRecord(
        await request(resourceUrl(collection, id), {
          method: "PATCH",
          body: JSON.stringify(item),
        }),
        key,
      );
    },

    async remove(id) {
      await request(resourceUrl(collection, id), { method: "DELETE" });
    },
  };
}

interface RequestOptions {
  method: string;
  body?: string;
  signal?: AbortSignal;
}

async function request(url: string, init: RequestOptions): Promise<unknown> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (init.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  let response: Response;
  try {
    response = await fetch(url, {
      method: init.method,
      headers,
      ...(init.body !== undefined ? { body: init.body } : {}),
      ...(init.signal ? { signal: init.signal } : {}),
    });
  } catch (error) {
    if (isAbort(error)) {
      throw error;
    }
    throw error;
  }

  if (response.status === 204) {
    return undefined;
  }

  const payload = await readBody(response);
  if (!response.ok) {
    throw new ConnectorError(response.status, errorMessage(payload, response));
  }
  return payload;
}

async function readBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) {
    return undefined;
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function errorMessage(payload: unknown, response: Response): string {
  if (isRecord(payload)) {
    if (typeof payload.detail === "string" && payload.detail) {
      return payload.detail;
    }
    if (typeof payload.message === "string" && payload.message) {
      return payload.message;
    }
    if (typeof payload.title === "string" && payload.title) {
      return payload.title;
    }
  }
  if (typeof payload === "string" && payload) {
    return payload;
  }
  return response.statusText || `Request failed with status ${response.status}`;
}

function readRecord<T extends { id: string }>(payload: unknown, key: string): T {
  if (!isRecord(payload) || typeof payload[key] !== "string" || payload[key] === "") {
    throw new ConnectorError(502, `Response is missing ${key}`);
  }
  return payload as T;
}

function joinUrl(baseUrl: string, resource: string): string {
  return `${baseUrl.replace(/\/+$/, "")}/${resource.replace(/^\/+/, "")}`;
}

function resourceUrl(collection: string, id: string): string {
  return `${collection}/${encodeURIComponent(id)}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}
