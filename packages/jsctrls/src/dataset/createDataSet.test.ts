import { describe, expect, it } from "vitest";
import { ConnectorError } from "../connector/connectorError";
import { memoryConnector } from "../connector/memoryConnector";
import type { Connector } from "../connector/types";
import { createDataSet, DataSetError } from "./createDataSet";

interface Name {
  id: string;
  name: string;
}

const seed = (): Name[] => [
  { id: "1", name: "Ada" },
  { id: "2", name: "Grace" },
  { id: "3", name: "Katherine" },
];

describe("createDataSet", () => {
  it("opens on the first row", async () => {
    const dataset = createDataSet({ connector: memoryConnector(seed()) });
    expect(dataset.getSnapshot().state).toBe("idle");

    await dataset.open();

    const snapshot = dataset.getSnapshot();
    expect(snapshot.state).toBe("browse");
    expect(snapshot.rows.map((row) => row.name)).toEqual(["Ada", "Grace", "Katherine"]);
    expect(snapshot.current).toEqual({ id: "1", name: "Ada" });
    expect(snapshot.busy).toBe(false);
    expect(dataset.getSnapshot()).toBe(snapshot);
  });

  it("moves the cursor", async () => {
    const dataset = createDataSet({ connector: memoryConnector(seed()) });
    await dataset.open();

    dataset.next();
    expect(dataset.getSnapshot().current?.name).toBe("Grace");
    dataset.last();
    expect(dataset.getSnapshot().current?.name).toBe("Katherine");
    dataset.prior();
    expect(dataset.getSnapshot().current?.name).toBe("Grace");
    dataset.first();
    expect(dataset.getSnapshot().current?.name).toBe("Ada");
    dataset.locate("3");
    expect(dataset.getSnapshot().current?.id).toBe("3");
    dataset.next();
    expect(dataset.getSnapshot().current?.id).toBe("3");
  });

  it("appends a row and selects it", async () => {
    const dataset = createDataSet({ connector: memoryConnector(seed()) });
    await dataset.open();

    await dataset.append({ name: "Iris" });

    const snapshot = dataset.getSnapshot();
    expect(snapshot.state).toBe("browse");
    expect(snapshot.current?.name).toBe("Iris");
    expect(snapshot.rows).toHaveLength(4);
    expect(snapshot.pending).toBeNull();
  });

  it("keeps the typed values when post fails", async () => {
    const connector = memoryConnector<Name>([]);
    connector.create = () => Promise.reject(new ConnectorError(400, "name: must not be blank"));
    const dataset = createDataSet({ connector });
    await dataset.open();

    await expect(dataset.append({ name: "Iris" })).rejects.toBeInstanceOf(ConnectorError);

    const snapshot = dataset.getSnapshot();
    expect(snapshot.state).toBe("inserting");
    expect(snapshot.pending).toEqual({ name: "Iris" });
    expect(snapshot.error).toBe("name: must not be blank");
    expect(snapshot.rows).toEqual([]);
  });

  it("moves the cursor to the next row after delete, or the previous when last", async () => {
    const dataset = createDataSet({ connector: memoryConnector(seed()) });
    await dataset.open();
    dataset.locate("2");

    await dataset.delete();
    expect(dataset.getSnapshot().current).toEqual({ id: "3", name: "Katherine" });

    await dataset.delete();
    expect(dataset.getSnapshot().current).toEqual({ id: "1", name: "Ada" });
    expect(dataset.getSnapshot().rows).toEqual([{ id: "1", name: "Ada" }]);
  });

  it("keeps the row and records the error when delete fails", async () => {
    const connector = memoryConnector(seed());
    connector.remove = () => Promise.reject(new ConnectorError(500, "database down"));
    const dataset = createDataSet({ connector });
    await dataset.open();

    await expect(dataset.delete()).rejects.toBeInstanceOf(ConnectorError);

    const snapshot = dataset.getSnapshot();
    expect(snapshot.state).toBe("browse");
    expect(snapshot.current).toEqual({ id: "1", name: "Ada" });
    expect(snapshot.rows).toHaveLength(3);
    expect(snapshot.error).toBe("database down");
  });

  it("rejects overlapping posts and deletes", async () => {
    let releaseCreate: (row: Name) => void = () => undefined;
    let releaseRemove: () => void = () => undefined;
    const connector: Connector<Name> = {
      ...memoryConnector(seed()),
      create: () =>
        new Promise<Name>((resolve) => {
          releaseCreate = resolve;
        }),
      remove: () =>
        new Promise<void>((resolve) => {
          releaseRemove = resolve;
        }),
    };
    const dataset = createDataSet({ connector });
    await dataset.open();

    const posting = dataset.append({ name: "Iris" });
    expect(dataset.getSnapshot().state).toBe("posting");
    expect(() => dataset.post()).toThrow(DataSetError);
    expect(() => dataset.insert()).toThrow(DataSetError);
    releaseCreate({ id: "9", name: "Iris" });
    await posting;

    const deleting = dataset.delete();
    expect(dataset.getSnapshot().state).toBe("deleting");
    expect(() => dataset.delete()).toThrow(DataSetError);
    releaseRemove();
    await deleting;
  });
});
