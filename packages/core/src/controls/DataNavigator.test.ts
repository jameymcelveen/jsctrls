import { describe, expect, it } from "vitest";
import { memoryConnector } from "../connector/memoryConnector";
import type { Connector } from "../connector/types";
import { createDataSet, DataSetError } from "../dataset/createDataSet";
import { createDataNavigatorController } from "./DataNavigator";
import { dataNavigatorButtons, type DataNavigatorButtonId } from "./properties";

interface Name {
  id: string;
  name: string;
}

const rows = (): Name[] => [
  { id: "1", name: "Ada" },
  { id: "2", name: "Grace" },
  { id: "3", name: "Katherine" },
];

async function openNavigator(records: Name[] = rows()) {
  const dataSet = createDataSet({ connector: memoryConnector(records) });
  await dataSet.open();
  return { dataSet, navigator: createDataNavigatorController({ dataSet }) };
}

function enabledMap(
  buttons: readonly { id: DataNavigatorButtonId; enabled: boolean }[],
): Record<DataNavigatorButtonId, boolean> {
  return Object.fromEntries(buttons.map((button) => [button.id, button.enabled])) as Record<
    DataNavigatorButtonId,
    boolean
  >;
}

describe("DataNavigator controller", () => {
  it("lists every button in toolbar order", async () => {
    const { navigator } = await openNavigator();
    const buttons = navigator.getSnapshot().buttons;
    expect(buttons.map((button) => button.id)).toEqual([...dataNavigatorButtons]);
    expect(buttons.map((button) => button.label)).toEqual([
      "First",
      "Prior",
      "Next",
      "Last",
      "Insert",
      "Delete",
      "Edit",
      "Post",
      "Cancel",
      "Refresh",
    ]);
  });

  it("moves next and stops at the ends", async () => {
    const { dataSet, navigator } = await openNavigator();
    let enabled = enabledMap(navigator.getSnapshot().buttons);
    expect(enabled.first).toBe(false);
    expect(enabled.prior).toBe(false);
    expect(enabled.next).toBe(true);
    expect(enabled.last).toBe(true);

    navigator.press("next");
    expect(dataSet.getSnapshot().current?.name).toBe("Grace");

    navigator.press("last");
    expect(dataSet.getSnapshot().current?.name).toBe("Katherine");
    enabled = enabledMap(navigator.getSnapshot().buttons);
    expect(enabled.next).toBe(false);
    expect(enabled.last).toBe(false);
    expect(enabled.first).toBe(true);
    expect(enabled.prior).toBe(true);
  });

  it("does not fetch when moving", async () => {
    let lists = 0;
    const base = memoryConnector(rows());
    const connector: Connector<Name> = {
      ...base,
      list: async (query) => {
        lists += 1;
        return query ? base.list(query) : base.list();
      },
    };
    const dataSet = createDataSet({ connector });
    await dataSet.open();
    const navigator = createDataNavigatorController({ dataSet });
    navigator.press("next");
    navigator.press("first");
    expect(lists).toBe(1);
    expect(dataSet.getSnapshot().current?.name).toBe("Ada");
  });

  it("allows insert, edit, and delete only while browsing", async () => {
    const { dataSet, navigator } = await openNavigator();
    let enabled = enabledMap(navigator.getSnapshot().buttons);
    expect(enabled.insert).toBe(true);
    expect(enabled.edit).toBe(true);
    expect(enabled.delete).toBe(true);
    expect(enabled.post).toBe(false);
    expect(enabled.cancel).toBe(false);

    navigator.press("insert");
    dataSet.setField("name", "Iris");
    enabled = enabledMap(navigator.getSnapshot().buttons);
    expect(dataSet.getSnapshot().state).toBe("inserting");
    expect(enabled.insert).toBe(false);
    expect(enabled.edit).toBe(false);
    expect(enabled.delete).toBe(false);
    expect(enabled.next).toBe(false);
    expect(enabled.post).toBe(true);
    expect(enabled.cancel).toBe(true);

    navigator.press("cancel");
    expect(dataSet.getSnapshot().state).toBe("browse");
    expect(dataSet.getSnapshot().pending).toBeNull();
    expect(dataSet.getSnapshot().current?.name).toBe("Ada");
  });

  it("returns the promise for post, delete, and refresh", async () => {
    const { dataSet, navigator } = await openNavigator([{ id: "1", name: "Ada" }]);
    navigator.press("edit");
    dataSet.setField("name", "Augusta");
    const posted = navigator.press("post");
    expect(posted).toBeInstanceOf(Promise);
    await posted;
    expect(dataSet.getSnapshot().current?.name).toBe("Augusta");

    const deleted = navigator.press("delete");
    expect(deleted).toBeInstanceOf(Promise);
    await deleted;
    expect(dataSet.getSnapshot().rows).toEqual([]);

    const refreshed = navigator.press("refresh");
    expect(refreshed).toBeInstanceOf(Promise);
    await refreshed;
    expect(dataSet.getSnapshot().state).toBe("browse");
  });

  it("throws when delete is illegal", async () => {
    const { navigator } = await openNavigator([]);
    expect(enabledMap(navigator.getSnapshot().buttons).delete).toBe(false);
    expect(enabledMap(navigator.getSnapshot().buttons).insert).toBe(true);
    expect(() => navigator.press("delete")).toThrow(DataSetError);
  });

  it("disables every button while the dataset is busy", async () => {
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
    const navigator = createDataNavigatorController({ dataSet });
    navigator.press("edit");
    const posted = navigator.press("post");
    expect(navigator.getSnapshot().buttons.every((button) => !button.enabled)).toBe(true);
    release({ id: "1", name: "Ada" });
    await posted;
    expect(enabledMap(navigator.getSnapshot().buttons).refresh).toBe(true);
  });

  it("shows a subset in toolbar order", async () => {
    const dataSet = createDataSet({ connector: memoryConnector(rows()) });
    await dataSet.open();
    const navigator = createDataNavigatorController({
      dataSet,
      buttons: ["cancel", "next", "post"],
    });
    expect(navigator.getSnapshot().buttons.map((button) => button.id)).toEqual([
      "next",
      "post",
      "cancel",
    ]);
  });
});
