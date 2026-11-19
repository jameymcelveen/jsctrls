import { useSyncExternalStore } from "react";
import type { DataSet, DataSetSnapshot } from "@jsctrls/core";

/** Subscribe a component to a DataSet snapshot. */
export function useDataSet<T extends { id: string }>(dataSet: DataSet<T>): DataSetSnapshot<T> {
  return useSyncExternalStore(dataSet.subscribe, dataSet.getSnapshot, dataSet.getSnapshot);
}
