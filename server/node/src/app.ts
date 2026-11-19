import cors from "@fastify/cors";
import Fastify, { type FastifyReply, type FastifyInstance } from "fastify";

/** One row of the names API (specs/006-names-api). */
export interface Name {
  id: string;
  name: string;
}

export interface AppOptions {
  /** Delay per names call, so a UI can show its saving and deleting states. */
  delayMs?: number;
}

/** In-memory store, seeded with Ada, Grace and Katherine. */
class NameStore {
  readonly #names = new Map<string, Name>();
  #nextId = 1;

  constructor() {
    for (const name of ["Ada", "Grace", "Katherine"]) {
      this.create(name);
    }
  }

  list(): Name[] {
    return [...this.#names.values()].sort(
      (a, b) => Number(a.id) - Number(b.id) || a.id.localeCompare(b.id),
    );
  }

  get(id: string): Name | undefined {
    return this.#names.get(id);
  }

  create(name: string): Name {
    const created = { id: String(this.#nextId++), name };
    this.#names.set(created.id, created);
    return created;
  }

  update(id: string, name: string): Name | undefined {
    const existing = this.#names.get(id);
    if (existing) {
      existing.name = name;
    }
    return existing;
  }

  delete(id: string): boolean {
    return this.#names.delete(id);
  }
}

/** An RFC 9457 problem detail. */
function problem(reply: FastifyReply, status: 400 | 404, detail: string) {
  return reply
    .code(status)
    .type("application/problem+json")
    .send({
      type: "about:blank",
      title: status === 400 ? "Bad Request" : "Not Found",
      status,
      detail,
    });
}

/** Trims and checks the body's name. Returns the name, or an error detail. */
function readName(body: unknown): { name: string } | { error: string } {
  const raw = (body as { name?: unknown } | null)?.name;
  if (typeof raw !== "string" || raw.trim() === "") {
    return { error: "name: must not be blank" };
  }
  if ([...raw].length > 100) {
    return { error: "name: size must be between 0 and 100" };
  }
  return { name: raw.trim() };
}

type ById = { Params: { id: string } };

export async function buildApp({ delayMs = 300 }: AppOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  const store = new NameStore();

  await app.register(cors, {
    origin: ["http://localhost:5173", "http://127.0.0.1:5173"],
    methods: ["GET", "POST", "PATCH", "DELETE"],
  });

  // A body that is not JSON is a bad request about the name, like the other servers.
  app.setErrorHandler((error, _request, reply) => {
    const status = (error as { statusCode?: number }).statusCode;
    if (status === 400 || status === 415) {
      return problem(reply, 400, "name: must not be blank");
    }
    return reply.send(error);
  });

  app.get("/actuator/health", async () => ({ status: "UP" }));

  await app.register(async (names) => {
    names.addHook("onRequest", async () => {
      if (delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    });

    names.get("/api/names", async () => store.list());

    names.get<ById>("/api/names/:id", async (request, reply) => {
      const found = store.get(request.params.id);
      return found ?? problem(reply, 404, `Name not found: ${request.params.id}`);
    });

    names.post("/api/names", async (request, reply) => {
      const result = readName(request.body);
      if ("error" in result) {
        return problem(reply, 400, result.error);
      }
      const created = store.create(result.name);
      return reply.code(201).header("Location", `/api/names/${created.id}`).send(created);
    });

    names.patch<ById>("/api/names/:id", async (request, reply) => {
      const { id } = request.params;
      if (!store.get(id)) {
        return problem(reply, 404, `Name not found: ${id}`);
      }
      const result = readName(request.body);
      if ("error" in result) {
        return problem(reply, 400, result.error);
      }
      return store.update(id, result.name);
    });

    names.delete<ById>("/api/names/:id", async (request, reply) => {
      if (!store.delete(request.params.id)) {
        return problem(reply, 404, `Name not found: ${request.params.id}`);
      }
      return reply.code(204).send();
    });
  });

  return app;
}
