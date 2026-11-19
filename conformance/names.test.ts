/**
 * Conformance suite for the names API (specs/006-names-api), over plain HTTP.
 * Every demo server, in every language, must pass it unchanged.
 *
 *   NAMES_API_URL=http://127.0.0.1:8090 pnpm --filter conformance conformance
 *
 * Only the first test needs a fresh server. Every other test creates the
 * records it changes, so the suite never depends on test order beyond that.
 */
import { describe, expect, it } from "vitest";

const base = (process.env.NAMES_API_URL ?? "http://127.0.0.1:8081").replace(/\/$/, "");

interface Name {
  id: string;
  name: string;
}

function call(method: string, path: string, body?: unknown, headers: Record<string, string> = {}) {
  return fetch(base + path, {
    method,
    headers: body === undefined ? headers : { "Content-Type": "application/json", ...headers },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

async function create(name: string): Promise<Name> {
  const response = await call("POST", "/api/names", { name });
  expect(response.status).toBe(201);
  return (await response.json()) as Name;
}

async function expectProblem(response: Response, status: number, title: string, detail: string) {
  expect(response.status).toBe(status);
  expect(response.headers.get("content-type") ?? "").toContain("application/problem+json");
  const problem = (await response.json()) as { title?: string; detail?: string; status?: number };
  expect(problem.title).toBe(title);
  expect(problem.detail ?? "").toContain(detail);
}

describe(`names API at ${base}`, () => {
  it("list returns the seeded names", async () => {
    const response = await call("GET", "/api/names");
    expect(response.status).toBe(200);
    const names = (await response.json()) as Name[];
    expect(names.map((name) => name.name)).toEqual(["Ada", "Grace", "Katherine"]);
    expect(names.map((name) => name.id)).toEqual(["1", "2", "3"]);
  });

  it("get returns one name", async () => {
    const response = await call("GET", "/api/names/2");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ id: "2", name: "Grace" });
  });

  it("a missing name is a problem detail", async () => {
    await expectProblem(
      await call("GET", "/api/names/missing"),
      404,
      "Not Found",
      "Name not found: missing",
    );
  });

  it("create trims the name and returns a location", async () => {
    const response = await call("POST", "/api/names", { name: "  Iris  " });
    expect(response.status).toBe(201);
    const created = (await response.json()) as Name;
    expect(created.name).toBe("Iris");
    expect(created.id).not.toBe("");
    expect(response.headers.get("location") ?? "").toContain(`/api/names/${created.id}`);
    const stored = await call("GET", `/api/names/${encodeURIComponent(created.id)}`);
    expect(await stored.json()).toEqual(created);
  });

  it("a blank name is a bad request", async () => {
    await expectProblem(
      await call("POST", "/api/names", { name: "   " }),
      400,
      "Bad Request",
      "name",
    );
  });

  it("a name longer than 100 characters is a bad request", async () => {
    await expectProblem(
      await call("POST", "/api/names", { name: "a".repeat(101) }),
      400,
      "Bad Request",
      "name",
    );
  });

  it("update trims the name", async () => {
    const created = await create("Update me");
    const response = await call("PATCH", `/api/names/${encodeURIComponent(created.id)}`, {
      name: "  Augusta  ",
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ id: created.id, name: "Augusta" });
  });

  it("updating a missing name is a problem detail", async () => {
    await expectProblem(
      await call("PATCH", "/api/names/missing", { name: "Ada" }),
      404,
      "Not Found",
      "Name not found: missing",
    );
  });

  it("delete removes the name", async () => {
    const created = await create("Delete me");
    const path = `/api/names/${encodeURIComponent(created.id)}`;
    expect((await call("DELETE", path)).status).toBe(204);
    expect((await call("GET", path)).status).toBe(404);
  });

  it("deleting a missing name is a problem detail", async () => {
    await expectProblem(
      await call("DELETE", "/api/names/missing"),
      404,
      "Not Found",
      "Name not found: missing",
    );
  });

  it("the Vite origin is allowed", async () => {
    const response = await call("GET", "/api/names", undefined, {
      Origin: "http://localhost:5173",
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("access-control-allow-origin")).toBe("http://localhost:5173");
  });

  it("the health probe reports UP", async () => {
    const response = await call("GET", "/actuator/health");
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ status: "UP" });
  });
});

/** Edges of the same contract: FR-001, FR-004, FR-005, FR-006 and FR-008. */
describe(`names API edges at ${base}`, () => {
  async function list(): Promise<Name[]> {
    const response = await call("GET", "/api/names");
    expect(response.status).toBe(200);
    return (await response.json()) as Name[];
  }

  it("ids sort as numbers, so 10 comes after 9", async () => {
    let names = await list();
    while (Math.max(...names.map((name) => Number(name.id))) < 10) {
      await create("Count me");
      names = await list();
    }
    const ids = names.map((name) => Number(name.id));
    expect(ids).toEqual([...ids].sort((a, b) => a - b));
  });

  it("a name of exactly 100 characters is accepted", async () => {
    const created = await create("b".repeat(100));
    expect(created.name).toHaveLength(100);
  });

  it("an update with a blank name is a bad request", async () => {
    const created = await create("Keep me");
    const path = `/api/names/${encodeURIComponent(created.id)}`;
    await expectProblem(await call("PATCH", path, { name: "  " }), 400, "Bad Request", "name");
    expect(await (await call("GET", path)).json()).toEqual(created);
  });

  it("an update is what a later get returns", async () => {
    const created = await create("Before");
    const path = `/api/names/${encodeURIComponent(created.id)}`;
    expect((await call("PATCH", path, { name: "After" })).status).toBe(200);
    expect(await (await call("GET", path)).json()).toEqual({ id: created.id, name: "After" });
  });

  it("a deleted name leaves the list", async () => {
    const created = await create("Gone soon");
    expect((await call("DELETE", `/api/names/${encodeURIComponent(created.id)}`)).status).toBe(204);
    expect((await list()).map((name) => name.id)).not.toContain(created.id);
  });

  it("the 127.0.0.1 Vite origin is allowed", async () => {
    const response = await call("GET", "/api/names", undefined, {
      Origin: "http://127.0.0.1:5173",
    });
    expect(response.headers.get("access-control-allow-origin")).toBe("http://127.0.0.1:5173");
  });

  for (const method of ["POST", "PATCH", "DELETE"]) {
    it(`a ${method} preflight from the Vite origin is allowed`, async () => {
      const response = await call("OPTIONS", "/api/names/1", undefined, {
        Origin: "http://localhost:5173",
        "Access-Control-Request-Method": method,
        "Access-Control-Request-Headers": "content-type",
      });
      expect(response.status).toBeLessThan(300);
      expect(response.headers.get("access-control-allow-origin")).toBe("http://localhost:5173");
      expect((response.headers.get("access-control-allow-methods") ?? "").toUpperCase()).toContain(
        method,
      );
    });
  }

  it("another origin is not allowed", async () => {
    const response = await call("GET", "/api/names", undefined, {
      Origin: "http://evil.example",
    });
    expect(response.headers.get("access-control-allow-origin")).toBeNull();
  });
});
