import type { DataSet, DataSetSnapshot } from "../dataset/createDataSet";
import {
  dataNavigatorButtons,
  type DataNavigatorButtonId,
  type DataNavigatorProperties,
} from "./properties";

export interface DataNavigatorButton {
  readonly id: DataNavigatorButtonId;
  readonly label: string;
  readonly enabled: boolean;
}

export interface DataNavigatorSnapshot {
  readonly buttons: readonly DataNavigatorButton[];
}

export interface DataNavigatorController {
  subscribe(listener: () => void): () => void;
  getSnapshot(): DataNavigatorSnapshot;
  /** Calls the matching DataSet method. Async methods return their promise. */
  press(id: DataNavigatorButtonId): void | Promise<void>;
}

const labels: Record<DataNavigatorButtonId, string> = {
  first: "First",
  prior: "Prior",
  next: "Next",
  last: "Last",
  insert: "Insert",
  delete: "Delete",
  edit: "Edit",
  post: "Post",
  cancel: "Cancel",
  refresh: "Refresh",
};

/** The DataNavigator behavior with no UI framework. */
export function createDataNavigatorController<T extends { id: string }>({
  dataSet,
  buttons,
}: DataNavigatorProperties<T>): DataNavigatorController {
  const shown = dataNavigatorButtons.filter((id) => buttons === undefined || buttons.includes(id));
  let source: DataSetSnapshot<T> | null = null;
  let snapshot: DataNavigatorSnapshot | null = null;

  function getSnapshot(): DataNavigatorSnapshot {
    const next = dataSet.getSnapshot();
    if (snapshot === null || next !== source) {
      source = next;
      snapshot = { buttons: shown.map((id) => button(id, next)) };
    }
    return snapshot;
  }

  return {
    subscribe: (listener) => dataSet.subscribe(listener),
    getSnapshot,
    press(id) {
      return actions(dataSet)[id]();
    },
  };
}

function button<T extends { id: string }>(
  id: DataNavigatorButtonId,
  source: DataSetSnapshot<T>,
): DataNavigatorButton {
  return { id, label: labels[id], enabled: isEnabled(id, source) };
}

/**
 * Delphi TDBNavigator rules, on this DataSet:
 * nothing while busy, no moves past the ends, post and cancel only while
 * inserting or editing, insert, edit, and delete only in browse.
 * Refresh stays off during an edit because a reload would drop the pending row.
 */
function isEnabled<T extends { id: string }>(
  id: DataNavigatorButtonId,
  source: DataSetSnapshot<T>,
): boolean {
  if (source.busy) {
    return false;
  }
  const editing = source.state === "inserting" || source.state === "editing";
  const browse = source.state === "browse";
  const index = source.current ? source.rows.findIndex((row) => row.id === source.current?.id) : -1;
  switch (id) {
    case "first":
    case "prior":
      return browse && index > 0;
    case "next":
    case "last":
      return browse && index >= 0 && index < source.rows.length - 1;
    case "insert":
      return browse;
    case "delete":
    case "edit":
      return browse && source.current !== null;
    case "post":
    case "cancel":
      return editing;
    case "refresh":
      return !editing;
  }
}

function actions<T extends { id: string }>(
  dataSet: DataSet<T>,
): Record<DataNavigatorButtonId, () => void | Promise<void>> {
  return {
    first: () => {
      dataSet.first();
    },
    prior: () => {
      dataSet.prior();
    },
    next: () => {
      dataSet.next();
    },
    last: () => {
      dataSet.last();
    },
    insert: () => {
      dataSet.insert();
    },
    delete: () => dataSet.delete(),
    edit: () => {
      dataSet.edit();
    },
    post: () => dataSet.post(),
    cancel: () => {
      dataSet.cancel();
    },
    refresh: () => dataSet.refresh(),
  };
}
