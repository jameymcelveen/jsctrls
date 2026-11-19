// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { act } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { createDataSet, memoryConnector } from "@jsctrls/core";
import { DataNavigator } from "./DataNavigator";

interface Name {
  id: string;
  name: string;
}

async function openNames(rows: Name[]) {
  const dataSet = createDataSet({ connector: memoryConnector(rows) });
  await dataSet.open();
  return dataSet;
}

const seed: Name[] = [
  { id: "1", name: "Ada" },
  { id: "2", name: "Grace" },
];

describe("DataNavigator", () => {
  afterEach(() => {
    cleanup();
  });

  it("moves to the next row", async () => {
    const dataSet = await openNames(seed);
    render(<DataNavigator dataSet={dataSet} />);
    expect(screen.getByRole("toolbar", { name: "Navigator" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "First" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(dataSet.getSnapshot().current?.name).toBe("Grace");
  });

  it("clears a pending insert on cancel", async () => {
    const dataSet = await openNames(seed);
    render(<DataNavigator dataSet={dataSet} />);
    act(() => {
      dataSet.insert();
      dataSet.setField("name", "Iris");
    });
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(dataSet.getSnapshot().pending).toBeNull();
    expect(dataSet.getSnapshot().state).toBe("browse");
  });

  it("disables post while browsing and delete when there is no row", async () => {
    const dataSet = await openNames([]);
    render(<DataNavigator dataSet={dataSet} />);
    expect(screen.getByRole("button", { name: "Post" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Delete" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Insert" })).toBeEnabled();
  });

  it("shows only the requested buttons", async () => {
    const dataSet = await openNames(seed);
    render(<DataNavigator dataSet={dataSet} buttons={["cancel", "next"]} />);
    expect(screen.getByRole("button", { name: "Next" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "First" })).toBeNull();
  });
});
