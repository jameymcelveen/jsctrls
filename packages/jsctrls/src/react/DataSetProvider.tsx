import { createContext, useContext, type ReactNode } from "react";
import type { DataSet } from "../dataset/createDataSet";

const DataSetContext = createContext<DataSet<{ id: string }> | null>(null);

/** Share one DataSet with the components below. */
export function DataSetProvider<T extends { id: string }>({
  dataSet,
  children,
}: {
  dataSet: DataSet<T>;
  children: ReactNode;
}) {
  return (
    <DataSetContext.Provider value={dataSet as DataSet<{ id: string }>}>
      {children}
    </DataSetContext.Provider>
  );
}

/** The DataSet from the nearest `DataSetProvider`. */
export function useDataSetContext<T extends { id: string }>(): DataSet<T> {
  const dataSet = useContext(DataSetContext);
  if (!dataSet) {
    throw new Error("useDataSetContext must be used inside DataSetProvider");
  }
  return dataSet as DataSet<T>;
}
