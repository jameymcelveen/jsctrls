import { describe, expect, it } from "vitest";
import { ConnectorError } from "../connector/connectorError";
import { memoryConnector } from "../connector/memoryConnector";
import type { Connector } from "../connector/types";
import { createDataSet } from "../dataset/createDataSet";
import { createListBoxController } from "./ListBox";

interface Name {
  id: string;
  name: string;
}

const seed = (): Name[] => [
  { id: "1", name: "Ada" },
  { id: "2", name: "Grace" },
  { id: "3", name: "Katherine" },
];

async function openList(connector: Connector<Name> = memoryConnector(seed())) {
  const dataSet = createDataSet({ connector });
  await dataSet.open();
  return { dataSet, list: createListBoxController({ dataSet, display: "name" }) };
}

describe("ListBox controller", () => {
  it("labels the options and selects the current row", async () => {
    const { list } = await openList();
    const { options, list: attributes } = list.getSnapshot();
    expect(options.map((option) => option.label)).toEqual(["Ada", "Grace", "Katherine"]);
    expect(options[0]?.selected).toBe(true);
    expect(options[0]?.attributes).toEqual({
      id: "jsctrls-option-1",
      role: "option",
      "aria-selected": "true",
    });
    expect(attributes).toEqual({
      role: "listbox",
      tabindex: "0",
      "aria-activedescendant": "jsctrls-option-1",
    });
  });

  it("moves the cursor on select and arrow keys", async () => {
    const { list } = await openList();
    list.select("2");
    expect(list.keyDown("ArrowDown")).toBe(true);
    expect(list.getSnapshot().options.find((option) => option.selected)?.label).toBe("Katherine");
    list.keyDown("ArrowDown");
    expect(list.getSnapshot().options.find((option) => option.selected)?.label).toBe("Katherine");
    list.keyDown("ArrowUp");
    expect(list.getSnapshot().options.find((option) => option.selected)?.label).toBe("Grace");
  });

  it("ignores keys it does not use", async () => {
    const { list } = await openList();
    expect(list.keyDown("Enter")).toBe(false);
  });

  it("returns the same snapshot until the DataSet changes", async () => {
    const { list } = await openList();
    const first = list.getSnapshot();
    expect(list.getSnapshot()).toBe(first);
    list.select("3");
    expect(list.getSnapshot()).not.toBe(first);
  });

  it("notifies subscribers when the cursor moves", async () => {
    const { list } = await openList();
    let calls = 0;
    const unsubscribe = list.subscribe(() => {
      calls += 1;
    });
    list.select("2");
    unsubscribe();
    list.select("3");
    expect(calls).toBe(1);
  });

  it("reports the status and the error", async () => {
    const connector: Connector<Name> = {
      ...memoryConnector(seed()),
      remove: () => Promise.reject(new ConnectorError(500, "database down")),
    };
    const { dataSet, list } = await openList(connector);
    const deleting = dataSet.delete().catch(() => undefined);
    expect(list.getSnapshot().status).toBe("deleting...");
    await deleting;
    expect(list.getSnapshot().status).toBeNull();
    expect(list.getSnapshot().error).toBe("database down");
  });
});
