import { delay, http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { ConnectorError } from "./connectorError";
import { restConnector } from "./restConnector";

interface Name {
  id: string;
  name: string;
}

const collection = "http://localhost/api/names";

const server = setupServer();

beforeAll(() => {
  server.listen({ onUnhandledRequest: "error" });
});

afterEach(() => {
  server.resetHandlers();
});

afterAll(() => {
  server.close();
});

describe("restConnector", () => {
  let rows: Name[];

  beforeEach(() => {
    rows = [{ id: "1", name: "Ada" }];
    server.use(
      http.get(collection, () => HttpResponse.json(rows)),
      http.get(`${collection}/:id`, ({ params }) => {
        const row = rows.find((item) => item.id === params.id);
        if (!row) {
          return HttpResponse.json(
            { title: "Not Found", detail: `Name not found: ${String(params.id)}` },
            { status: 404 },
          );
        }
        return HttpResponse.json(row);
      }),
      http.post(collection, async ({ request }) => {
        const body = (await request.json()) as { name: string };
        const created = { id: "9", name: body.name };
        rows.push(created);
        return HttpResponse.json(created, { status: 201 });
      }),
      http.patch(`${collection}/:id`, async ({ params, request }) => {
        const body = (await request.json()) as Partial<Name>;
        const index = rows.findIndex((item) => item.id === params.id);
        const current = rows[index];
        if (!current) {
          return HttpResponse.json(
            { detail: `Name not found: ${String(params.id)}` },
            { status: 404 },
          );
        }
        const updated = { ...current, ...body, id: current.id };
        rows[index] = updated;
        return HttpResponse.json(updated);
      }),
      http.delete(`${collection}/:id`, ({ params }) => {
        const index = rows.findIndex((item) => item.id === params.id);
        if (index < 0) {
          return HttpResponse.json(
            { detail: `Name not found: ${String(params.id)}` },
            { status: 404 },
          );
        }
        rows.splice(index, 1);
        return new HttpResponse(null, { status: 204 });
      }),
    );
  });

  const connector = () =>
    restConnector<Name>({ baseUrl: "http://localhost/api", resource: "names" });

  it("lists rows", async () => {
    await expect(connector().list()).resolves.toEqual([{ id: "1", name: "Ada" }]);
  });

  it("gets one row", async () => {
    await expect(connector().get("1")).resolves.toEqual({ id: "1", name: "Ada" });
  });

  it("creates a row", async () => {
    await expect(connector().create({ name: "Iris" })).resolves.toEqual({ id: "9", name: "Iris" });
    await expect(connector().list()).resolves.toEqual([
      { id: "1", name: "Ada" },
      { id: "9", name: "Iris" },
    ]);
  });

  it("updates a row", async () => {
    await expect(connector().update("1", { name: "Augusta" })).resolves.toEqual({
      id: "1",
      name: "Augusta",
    });
  });

  it("removes a row", async () => {
    await connector().remove("1");
    await expect(connector().list()).resolves.toEqual([]);
  });

  it("throws ConnectorError with the problem detail", async () => {
    const error = await connector()
      .get("missing")
      .then(
        () => {
          throw new Error("expected get to fail");
        },
        (caught: unknown) => caught,
      );
    expect(error).toBeInstanceOf(ConnectorError);
    expect(error).toMatchObject({ status: 404, message: "Name not found: missing" });
  });

  it("uses the response text when the error body is not JSON", async () => {
    server.use(http.get(collection, () => new HttpResponse("nope", { status: 500 })));
    await expect(connector().list()).rejects.toMatchObject({ status: 500, message: "nope" });
  });

  it("aborts an in-flight list", async () => {
    server.use(
      http.get(collection, async () => {
        await delay("infinite");
        return HttpResponse.json([]);
      }),
    );
    const controller = new AbortController();
    const pending = connector().list({ signal: controller.signal });
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
  });
});
