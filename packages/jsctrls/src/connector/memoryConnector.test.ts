import { describe, expect, it } from "vitest";
import { ConnectorError } from "./connectorError";
import { memoryConnector } from "./memoryConnector";

interface Name {
  id: string;
  name: string;
}

const seed = (): Name[] => [
  { id: "1", name: "Ada" },
  { id: "2", name: "Grace" },
];

describe("memoryConnector", () => {
  it("lists a copy of the rows", async () => {
    const connector = memoryConnector(seed());
    const rows = await connector.list();
    rows[0]!.name = "changed";
    expect(await connector.list()).toEqual(seed());
  });

  it("gets one row", async () => {
    const connector = memoryConnector(seed());
    expect(await connector.get("2")).toEqual({ id: "2", name: "Grace" });
  });

  it("fails get when the id is missing", async () => {
    const connector = memoryConnector(seed());
    await expect(connector.get("missing")).rejects.toMatchObject({
      name: "ConnectorError",
      status: 404,
    });
  });

  it("assigns an id on create", async () => {
    const connector = memoryConnector<Name>([]);
    const created = await connector.create({ name: "Iris" });
    expect(created.id).toEqual(expect.any(String));
    expect(created.name).toBe("Iris");
    expect(await connector.get(created.id)).toEqual(created);
  });

  it("updates a row", async () => {
    const connector = memoryConnector(seed());
    expect(await connector.update("1", { name: "Augusta" })).toEqual({ id: "1", name: "Augusta" });
    expect(await connector.get("1")).toEqual({ id: "1", name: "Augusta" });
  });

  it("fails update when the id is missing", async () => {
    const connector = memoryConnector(seed());
    await expect(connector.update("missing", { name: "Ada" })).rejects.toBeInstanceOf(
      ConnectorError,
    );
  });

  it("removes a row", async () => {
    const connector = memoryConnector(seed());
    await connector.remove("1");
    expect(await connector.list()).toEqual([{ id: "2", name: "Grace" }]);
  });

  it("fails remove when the id is missing", async () => {
    const connector = memoryConnector(seed());
    await expect(connector.remove("missing")).rejects.toMatchObject({ status: 404 });
  });

  it("rejects list when the signal is already aborted", async () => {
    const connector = memoryConnector(seed());
    const signal = AbortSignal.abort();
    await expect(connector.list({ signal })).rejects.toMatchObject({ name: "AbortError" });
  });
});
