export { ConnectorError } from "./connector/connectorError";
export { createDataSet, DataSetError } from "./dataset/createDataSet";
export { DataSetProvider, useDataSetContext } from "./react/DataSetProvider";
export { useDataSet } from "./react/useDataSet";
export type { DataSet, DataSetSnapshot, DataSetState } from "./dataset/createDataSet";
export { memoryConnector } from "./connector/memoryConnector";
export { restConnector } from "./connector/restConnector";
export type { RestConnectorOptions } from "./connector/restConnector";
export type { Connector, Query } from "./connector/types";

/** Workspace placeholder until the package is published. */
export const version = "0.0.0";
