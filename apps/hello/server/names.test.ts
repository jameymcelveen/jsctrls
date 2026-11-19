// @vitest-environment node

import { describe, expect, it } from "vitest";
import { createNamesApi } from "./names";

const base = "https://jsctrls.test";

function call(api: ReturnType<typeof createNamesApi>, method: string, path: string, body?: unknown) {
  return api.handle(
    new Request(base + path, {
      method,
      ...(body === undefined
        ? {}
        : { body: JSON.stringify(body), headers: { "Content-Type": "application/json" } }),
    }),
  );
}

const fresh = () => createNamesApi({ delayMs: 0 });

describe("names API (Vercel function)", () => {
  it("lists the seeded names", async () => {
    const response = await call(fresh(), "GET", "/api/names");
    expect(((await response.json()) as { name: string }[]).map((n) => n.name)).toEqual([
      "Ada",
      "Grace",
      "Katherine",
    ]);
  });

  it("gets one name by path or by the id query a rewrite adds", async () => {
    const api = fresh();
    expect(await (await call(api, "GET", "/api/names/2")).json()).toEqual({ id: "2", name: "Grace" });
    expect(await (await call(api, "GET", "/api/names?id=2")).json()).toEqual({ id: "2", name: "Grace" });
  });

  it("returns a 404 problem for a missing id", async () => {
    const response = await call(fresh(), "GET", "/api/names/99");
    expect(response.status).toBe(404);
    expect(response.headers.get("Content-Type")).toBe("application/problem+json");
    expect(await response.json()).toMatchObject({ title: "Not Found", detail: "Name not found: 99" });
  });

  it("creates a trimmed name with a location", async () => {
    const api = fresh();
    const response = await call(api, "POST", "/api/names", { name: "  Iris  " });
    expect(response.status).toBe(201);
    expect(response.headers.get("Location")).toBe(`${base}/api/names/4`);
    expect(await response.json()).toEqual({ id: "4", name: "Iris" });
  });

  it("rejects blank and long names with a 400 problem", async () => {
    const api = fresh();
    for (const name of ["   ", "x".repeat(101)]) {
      const response = await call(api, "POST", "/api/names", { name });
      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({ title: "Bad Request" });
    }
  });

  it("patches, then deletes", async () => {
    const api = fresh();
    expect(await (await call(api, "PATCH", "/api/names/1", { name: " Augusta " })).json()).toEqual({
      id: "1",
      name: "Augusta",
    });
    expect((await call(api, "DELETE", "/api/names/1")).status).toBe(204);
    expect((await call(api, "GET", "/api/names/1")).status).toBe(404);
    expect((await call(api, "DELETE", "/api/names/1")).status).toBe(404);
    expect((await call(api, "PATCH", "/api/names/1", { name: "x" })).status).toBe(404);
  });

  it("answers the health probe", async () => {
    expect(await (await call(fresh(), "GET", "/actuator/health")).json()).toEqual({ status: "UP" });
  });
});
