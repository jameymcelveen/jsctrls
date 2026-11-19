// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { act } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { createDataSet, memoryConnector } from "@jsctrls/core";
import { DataField } from "./DataField";

interface Name {
  id: string;
  name: string;
}

async function openNames(rows: Name[]) {
  const dataSet = createDataSet({ connector: memoryConnector(rows) });
  await dataSet.open();
  return dataSet;
}

describe("DataField", () => {
  afterEach(() => {
    cleanup();
  });

  it("follows the cursor", async () => {
    const dataSet = await openNames([
      { id: "1", name: "Ada" },
      { id: "2", name: "Grace" },
    ]);
    render(<DataField dataSet={dataSet} field="name" aria-label="Name" />);
    const input = screen.getByRole("textbox", { name: "Name" });
    expect(input).toHaveValue("Ada");

    act(() => {
      dataSet.locate("2");
    });
    expect(input).toHaveValue("Grace");
  });

  it("puts the dataset in editing and keeps the pending value", async () => {
    const dataSet = await openNames([{ id: "1", name: "Ada" }]);
    render(<DataField dataSet={dataSet} field="name" aria-label="Name" />);
    fireEvent.change(screen.getByRole("textbox", { name: "Name" }), {
      target: { value: "Augusta" },
    });
    const snapshot = dataSet.getSnapshot();
    expect(snapshot.state).toBe("editing");
    expect(snapshot.pending).toMatchObject({ name: "Augusta" });
    expect(screen.getByRole("textbox", { name: "Name" })).toHaveValue("Augusta");
  });

  it("shows the saved value after post", async () => {
    const dataSet = await openNames([{ id: "1", name: "Ada" }]);
    render(<DataField dataSet={dataSet} field="name" aria-label="Name" />);
    fireEvent.change(screen.getByRole("textbox", { name: "Name" }), {
      target: { value: "Augusta" },
    });
    await act(async () => {
      await dataSet.post();
    });
    expect(dataSet.getSnapshot().current?.name).toBe("Augusta");
    expect(screen.getByRole("textbox", { name: "Name" })).toHaveValue("Augusta");
  });

  it("restores the value on cancel", async () => {
    const dataSet = await openNames([{ id: "1", name: "Ada" }]);
    render(<DataField dataSet={dataSet} field="name" aria-label="Name" />);
    fireEvent.change(screen.getByRole("textbox", { name: "Name" }), {
      target: { value: "Augusta" },
    });
    act(() => {
      dataSet.cancel();
    });
    expect(dataSet.getSnapshot().pending).toBeNull();
    expect(screen.getByRole("textbox", { name: "Name" })).toHaveValue("Ada");
  });

  it("is disabled when there is no row", async () => {
    const dataSet = await openNames([]);
    render(<DataField dataSet={dataSet} field="name" aria-label="Name" placeholder="Name" />);
    const input = screen.getByRole("textbox", { name: "Name" });
    expect(input).toBeDisabled();
    expect(input).toHaveAttribute("placeholder", "Name");
    expect(input).toHaveValue("");
  });
});
