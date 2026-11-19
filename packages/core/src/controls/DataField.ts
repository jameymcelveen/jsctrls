import type { DataSetSnapshot } from "../dataset/createDataSet";
import type { DataFieldProperties, StringFieldOf } from "./properties";

export interface DataFieldSnapshot {
  /** Pending value while inserting or editing, otherwise the current row, otherwise "". */
  readonly value: string;
  /** No current row and not inserting: there is nothing to edit. */
  readonly disabled: boolean;
  /** The dataset is busy. Read-only, not disabled, so the field keeps keyboard focus. */
  readonly readOnly: boolean;
  readonly error: string | null;
}

export interface DataFieldController {
  subscribe(listener: () => void): () => void;
  getSnapshot(): DataFieldSnapshot;
  /** Start an edit when browsing, then write the field. Does not call the connector. */
  change(value: string): void;
}

/** The DataField behavior with no UI framework: one bound field. */
export function createDataFieldController<T extends { id: string }>({
  dataSet,
  field,
}: DataFieldProperties<T>): DataFieldController {
  let source: DataSetSnapshot<T> | null = null;
  let snapshot: DataFieldSnapshot | null = null;

  function getSnapshot(): DataFieldSnapshot {
    const next = dataSet.getSnapshot();
    if (snapshot === null || next !== source) {
      source = next;
      snapshot = derive(next, field);
    }
    return snapshot;
  }

  return {
    subscribe: (listener) => dataSet.subscribe(listener),
    getSnapshot,
    change(value) {
      if (dataSet.getSnapshot().state === "browse") {
        dataSet.edit();
      }
      // field only names text-valued keys (StringFieldOf), so a string is the right type here.
      dataSet.setField(field, value as T[StringFieldOf<T>]);
    },
  };
}

function derive<T extends { id: string }>(
  source: DataSetSnapshot<T>,
  field: StringFieldOf<T>,
): DataFieldSnapshot {
  const editing = source.state === "inserting" || source.state === "editing";
  const raw = editing ? source.pending?.[field] : source.current?.[field];
  return {
    value: raw == null ? "" : String(raw),
    disabled: source.current === null && source.state !== "inserting",
    readOnly: source.busy,
    error: source.error,
  };
}
