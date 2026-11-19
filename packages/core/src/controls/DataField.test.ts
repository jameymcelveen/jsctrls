import { describe, expect, it } from "vitest";
import { memoryConnector } from "../connector/memoryConnector";
import type { Connector } from "../connector/types";
import { createDataSet } from "../dataset/createDataSet";
import { createDataFieldController } from "./DataField";

interface Name {
  id: string;
  name: string;
}

async function openField(
  rows: Name[] = [
    { id: "1", name: "Ada" },
    { id: "2", name: "Grace" },
  ],
) {
  const dataSet = createDataSet({ connector: memoryConnector(rows) });
  await dataSet.open();
  return { dataSet, field: createDataFieldController({ dataSet, field: "name" }) };
}

describe("DataField controller", () => {
  it("shows the current row and follows the cursor", async () => {
    const { dataSet, field } = await openField();
    expect(field.getSnapshot().value).toBe("Ada");
    expect(field.getSnapshot().disabled).toBe(false);

    dataSet.locate("2");
    expect(field.getSnapshot().value).toBe("Grace");
  });

  it("edits on change and keeps the pending value", async () => {
    const { dataSet, field } = await openField();
    field.change("Augusta");
    const snapshot = dataSet.getSnapshot();
    expect(snapshot.state).toBe("editing");
    expect(snapshot.pending).toMatchObject({ name: "Augusta" });
    expect(field.getSnapshot().value).toBe("Augusta");
  });

  it("does not call the connector while typing", async () => {
    let updates = 0;
    const base = memoryConnector<Name>([{ id: "1", name: "Ada" }]);
    const connector: Connector<Name> = {
      ...base,
      update: async (id, item) => {
        updates += 1;
        return base.update(id, item);
      },
      create: async (item) => {
        throw new Error(`create was called with ${item.name}`);
      },
    };
    const dataSet = createDataSet({ connector });
    await dataSet.open();
    const field = createDataFieldController({ dataSet, field: "name" });
    field.change("Augusta");
    field.change("Ada Lovelace");
    expect(updates).toBe(0);
    expect(dataSet.getSnapshot().pending).toMatchObject({ name: "Ada Lovelace" });
  });

  it("shows the posted value after post", async () => {
    const { dataSet, field } = await openField([{ id: "1", name: "Ada" }]);
    field.change("Augusta");
    await dataSet.post();
    expect(dataSet.getSnapshot().state).toBe("browse");
    expect(dataSet.getSnapshot().current?.name).toBe("Augusta");
    expect(field.getSnapshot().value).toBe("Augusta");
  });

  it("restores the row value on cancel", async () => {
    const { dataSet, field } = await openField([{ id: "1", name: "Ada" }]);
    field.change("Augusta");
    dataSet.cancel();
    expect(dataSet.getSnapshot().state).toBe("browse");
    expect(dataSet.getSnapshot().pending).toBeNull();
    expect(field.getSnapshot().value).toBe("Ada");
  });

  it("is disabled when there is no row", async () => {
    const { field } = await openField([]);
    const snapshot = field.getSnapshot();
    expect(snapshot.value).toBe("");
    expect(snapshot.disabled).toBe(true);
  });

  it("is disabled while the dataset is busy", async () => {
    let release: (row: Name) => void = () => undefined;
    const connector: Connector<Name> = {
      ...memoryConnector<Name>([{ id: "1", name: "Ada" }]),
      update: () =>
        new Promise<Name>((resolve) => {
          release = resolve;
        }),
    };
    const dataSet = createDataSet({ connector });
    await dataSet.open();
    const field = createDataFieldController({ dataSet, field: "name" });
    field.change("Augusta");
    const posted = dataSet.post();
    expect(field.getSnapshot().disabled).toBe(true);
    release({ id: "1", name: "Augusta" });
    await posted;
    expect(field.getSnapshot().disabled).toBe(false);
  });
});
