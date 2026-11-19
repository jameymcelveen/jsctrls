import type { DataSet, DataSetSnapshot } from "../dataset/createDataSet";
import type { ListBoxProperties } from "./properties";

/** DOM attributes for the list element, as plain strings. */
export interface ListBoxListAttributes {
  readonly role: "listbox";
  readonly tabindex: "0";
  readonly "aria-activedescendant"?: string;
}

/** DOM attributes for one option element, as plain strings. */
export interface ListBoxOptionAttributes {
  readonly id: string;
  readonly role: "option";
  readonly "aria-selected": "true" | "false";
}

export interface ListBoxOption {
  readonly id: string;
  readonly label: string;
  readonly selected: boolean;
  readonly attributes: ListBoxOptionAttributes;
}

export interface ListBoxSnapshot {
  readonly options: readonly ListBoxOption[];
  readonly list: ListBoxListAttributes;
  /** `saving...`, `deleting...`, `loading...`, or null. */
  readonly status: string | null;
  readonly error: string | null;
}

export interface ListBoxController {
  subscribe(listener: () => void): () => void;
  getSnapshot(): ListBoxSnapshot;
  /** Move the DataSet cursor to this row. */
  select(id: string): void;
  /** Handle a key. Returns true when the key was used, so a skin can prevent the default. */
  keyDown(key: string): boolean;
}

/** The ListBox behavior with no UI framework: rows, cursor, keys, status, and ARIA. */
export function createListBoxController<T extends { id: string }>({
  dataSet,
  display,
}: ListBoxProperties<T>): ListBoxController {
  let source: DataSetSnapshot<T> | null = null;
  let snapshot: ListBoxSnapshot | null = null;

  function getSnapshot(): ListBoxSnapshot {
    const next = dataSet.getSnapshot();
    if (snapshot === null || next !== source) {
      source = next;
      snapshot = derive(next, display);
    }
    return snapshot;
  }

  return {
    subscribe: (listener) => dataSet.subscribe(listener),
    getSnapshot,
    select(id) {
      dataSet.locate(id);
    },
    keyDown(key) {
      if (key !== "ArrowUp" && key !== "ArrowDown") {
        return false;
      }
      move(dataSet, key === "ArrowUp" ? -1 : 1);
      return true;
    },
  };
}

function move<T extends { id: string }>(dataSet: DataSet<T>, step: -1 | 1): void {
  const { rows, current } = dataSet.getSnapshot();
  const index = current ? rows.findIndex((row) => row.id === current.id) : -1;
  const nextIndex = step < 0 ? Math.max(0, index - 1) : Math.min(rows.length - 1, index + 1);
  const next = rows[nextIndex];
  if (next) {
    dataSet.locate(next.id);
  }
}

function derive<T extends { id: string }>(
  source: DataSetSnapshot<T>,
  display: keyof T & string,
): ListBoxSnapshot {
  const currentId = source.current?.id ?? null;
  const options = source.rows.map((row): ListBoxOption => {
    const selected = row.id === currentId;
    return {
      id: row.id,
      label: String(row[display] ?? ""),
      selected,
      attributes: {
        id: optionDomId(row.id),
        role: "option",
        "aria-selected": selected ? "true" : "false",
      },
    };
  });
  const list: ListBoxListAttributes =
    currentId === null
      ? { role: "listbox", tabindex: "0" }
      : { role: "listbox", tabindex: "0", "aria-activedescendant": optionDomId(currentId) };
  return { options, list, status: statusOf(source.state), error: source.error };
}

function statusOf(state: DataSetSnapshot<unknown>["state"]): string | null {
  switch (state) {
    case "posting":
      return "saving...";
    case "deleting":
      return "deleting...";
    case "loading":
      return "loading...";
    default:
      return null;
  }
}

function optionDomId(id: string): string {
  return `jsctrls-option-${id}`;
}
