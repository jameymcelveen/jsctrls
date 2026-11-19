import assert from "node:assert/strict";
import { test } from "node:test";
import { buildApp } from "./app.ts";

const fresh = () => buildApp({ delayMs: 0 });

test("lists the seeded names in id order", async () => {
  const app = await fresh();
  const response = await app.inject({ method: "GET", url: "/api/names" });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), [
    { id: "1", name: "Ada" },
    { id: "2", name: "Grace" },
    { id: "3", name: "Katherine" },
  ]);
});

test("creates a trimmed name with a location", async () => {
  const app = await fresh();
  const response = await app.inject({ method: "POST", url: "/api/names", payload: { name: "  Iris  " } });
  assert.equal(response.statusCode, 201);
  assert.equal(response.headers.location, "/api/names/4");
  assert.deepEqual(response.json(), { id: "4", name: "Iris" });
});

test("rejects blank, missing, long, and non-JSON names with a 400 problem", async () => {
  const app = await fresh();
  const bodies = [{ name: "   " }, {}, { name: "a".repeat(101) }];
  for (const payload of bodies) {
    const response = await app.inject({ method: "POST", url: "/api/names", payload });
    assert.equal(response.statusCode, 400, JSON.stringify(payload));
    assert.match(String(response.headers["content-type"]), /application\/problem\+json/);
  }
  const broken = await app.inject({
    method: "POST",
    url: "/api/names",
    headers: { "content-type": "application/json" },
    payload: "not json",
  });
  assert.equal(broken.statusCode, 400);
  assert.equal(broken.json().title, "Bad Request");
});

test("missing ids are 404 problems for get, patch and delete", async () => {
  const app = await fresh();
  for (const method of ["GET", "PATCH", "DELETE"] as const) {
    const response = await app.inject({ method, url: "/api/names/missing", payload: { name: "Ada" } });
    assert.equal(response.statusCode, 404, method);
    assert.equal(response.json().detail, "Name not found: missing");
  }
});

test("ids sort numerically", async () => {
  const app = await fresh();
  for (let i = 0; i < 7; i++) {
    await app.inject({ method: "POST", url: "/api/names", payload: { name: "x" } });
  }
  const names = (await app.inject({ method: "GET", url: "/api/names" })).json() as { id: string }[];
  assert.equal(names.at(-1)?.id, "10");
});
