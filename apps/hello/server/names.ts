/**
 * The names API (spec 006) as one web-standard handler: Request in, Response out.
 * Vercel serves it from api/names.ts for jsctrls.com. The store is in memory,
 * so data resets when the function instance is recycled. Fine for a demo.
 */

interface Name {
  id: string;
  name: string;
}

export interface NamesApiOptions {
  /** Delay per call so the controls' saving and deleting states are visible. Default 300. */
  delayMs?: number;
}

const seed = (): Name[] => [
  { id: "1", name: "Ada" },
  { id: "2", name: "Grace" },
  { id: "3", name: "Katherine" },
];

export function createNamesApi({ delayMs = 300 }: NamesApiOptions = {}) {
  let names = seed();
  let nextId = names.length + 1;

  async function handle(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/actuator/health") {
      return json({ status: "UP" });
    }
    const match = /^\/api\/names(?:\/([^/]+))?\/?$/.exec(url.pathname);
    if (!match) {
      return problem(404, "Not Found", `No route for ${url.pathname}`);
    }
    const id = match[1] ?? url.searchParams.get("id") ?? undefined;

    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }

    switch (request.method) {
      case "GET": {
        if (id === undefined) {
          return json([...names].sort(byId));
        }
        const found = names.find((name) => name.id === id);
        return found ? json(found) : notFound(id);
      }
      case "POST": {
        if (id !== undefined) {
          return problem(405, "Method Not Allowed", "POST goes to /api/names");
        }
        const value = await readName(request);
        if (typeof value !== "string") {
          return value;
        }
        const created = { id: String(nextId++), name: value };
        names.push(created);
        return json(created, 201, { Location: `${url.origin}/api/names/${created.id}` });
      }
      case "PATCH": {
        const target = id === undefined ? undefined : names.find((name) => name.id === id);
        if (id === undefined || !target) {
          return notFound(id ?? "");
        }
        const value = await readName(request);
        if (typeof value !== "string") {
          return value;
        }
        target.name = value;
        return json(target);
      }
      case "DELETE": {
        if (id === undefined || !names.some((name) => name.id === id)) {
          return notFound(id ?? "");
        }
        names = names.filter((name) => name.id !== id);
        return new Response(null, { status: 204 });
      }
      default:
        return problem(405, "Method Not Allowed", `${request.method} is not supported`);
    }
  }

  return { handle };
}

async function readName(request: Request): Promise<string | Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return problem(400, "Bad Request", "name: must not be blank");
  }
  const raw = (body as { name?: unknown } | null)?.name;
  if (typeof raw !== "string" || raw.trim() === "") {
    return problem(400, "Bad Request", "name: must not be blank");
  }
  if (raw.length > 100) {
    return problem(400, "Bad Request", "name: size must be between 0 and 100");
  }
  return raw.trim();
}

function byId(a: Name, b: Name): number {
  return Number(a.id) - Number(b.id) || a.id.localeCompare(b.id);
}

function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

function problem(status: number, title: string, detail: string): Response {
  return new Response(JSON.stringify({ type: "about:blank", title, status, detail }), {
    status,
    headers: { "Content-Type": "application/problem+json" },
  });
}

function notFound(id: string): Response {
  return problem(404, "Not Found", `Name not found: ${id}`);
}
