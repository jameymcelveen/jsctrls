// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { act } from "react";
import { describe, expect, it } from "vitest";
import { memoryConnector } from "@jsctrls/core";
import { createDataSet, type DataSet } from "@jsctrls/core";
import { DataSetProvider, useDataSetContext } from "./DataSetProvider";
import { useDataSet } from "./useDataSet";

interface Name {
  id: string;
  name: string;
}

function CurrentName({ dataSet }: { dataSet: DataSet<Name> }) {
  const snapshot = useDataSet(dataSet);
  return <p>{snapshot.current?.name ?? "none"}</p>;
}

function ContextName() {
  const dataSet = useDataSetContext<Name>();
  const snapshot = useDataSet(dataSet);
  return <p>{snapshot.rows.length}</p>;
}

describe("useDataSet", () => {
  it("re-renders when the dataset changes", async () => {
    const dataSet = createDataSet<Name>({
      connector: memoryConnector([
        { id: "1", name: "Ada" },
        { id: "2", name: "Grace" },
      ]),
    });
    await dataSet.open();

    render(<CurrentName dataSet={dataSet} />);
    expect(screen.getByText("Ada")).toBeTruthy();

    act(() => {
      dataSet.next();
    });

    expect(screen.getByText("Grace")).toBeTruthy();
  });

  it("reads a dataset from context", async () => {
    const dataSet = createDataSet<Name>({
      connector: memoryConnector([{ id: "1", name: "Ada" }]),
    });
    await dataSet.open();

    render(
      <DataSetProvider dataSet={dataSet}>
        <ContextName />
      </DataSetProvider>,
    );

    expect(screen.getByText("1")).toBeTruthy();
  });
});
