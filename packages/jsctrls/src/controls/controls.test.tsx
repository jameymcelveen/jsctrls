// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { act } from "react";
import { describe, expect, it, vi } from "vitest";
import { ConnectorError } from "../connector/connectorError";
import { memoryConnector } from "../connector/memoryConnector";
import type { Connector } from "../connector/types";
import { createDataSet } from "../dataset/createDataSet";
import { Button } from "./Button";
import { ListBox } from "./ListBox";
import { TextInput } from "./TextInput";

interface Name {
  id: string;
  name: string;
}

const seed = (): Name[] => [
  { id: "1", name: "Ada" },
  { id: "2", name: "Grace" },
  { id: "3", name: "Katherine" },
];

describe("TextInput", () => {
  it("reports the typed value", () => {
    const onChange = vi.fn();
    render(<TextInput value="" onChange={onChange} aria-label="Name" />);
    fireEvent.change(screen.getByRole("textbox", { name: "Name" }), {
      target: { value: "Iris" },
    });
    expect(onChange).toHaveBeenCalledWith("Iris");
  });
});

describe("Button", () => {
  it("calls onClick", () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Add</Button>);
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("does not call onClick while disabled", () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Delete
      </Button>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(onClick).not.toHaveBeenCalled();
  });
});

describe("ListBox", () => {
  it("highlights the current row and moves with click and arrow keys", async () => {
    const dataSet = createDataSet({ connector: memoryConnector(seed()) });
    await dataSet.open();
    render(<ListBox dataSet={dataSet} display="name" />);

    const grace = screen.getByRole("option", { name: "Grace" });
    expect(screen.getByRole("option", { name: "Ada" })).toHaveAttribute("aria-selected", "true");

    fireEvent.click(grace);
    expect(grace).toHaveAttribute("aria-selected", "true");

    fireEvent.keyDown(screen.getByRole("listbox"), { key: "ArrowDown" });
    expect(screen.getByRole("option", { name: "Katherine" })).toHaveAttribute(
      "aria-selected",
      "true",
    );

    fireEvent.keyDown(screen.getByRole("listbox"), { key: "ArrowUp" });
    expect(grace).toHaveAttribute("aria-selected", "true");
  });

  it("shows saving, deleting, and the error", async () => {
    let releaseCreate: (row: Name) => void = () => undefined;
    let releaseRemove: () => void = () => undefined;
    const connector: Connector<Name> = {
      ...memoryConnector(seed()),
      create: () =>
        new Promise<Name>((resolve) => {
          releaseCreate = resolve;
        }),
      remove: () =>
        new Promise<void>((resolve) => {
          releaseRemove = resolve;
        }),
    };
    const dataSet = createDataSet({ connector });
    await dataSet.open();
    render(<ListBox dataSet={dataSet} display="name" />);

    act(() => {
      void dataSet.append({ name: "Iris" });
    });
    expect(screen.getByText("saving...")).toBeTruthy();
    await act(async () => {
      releaseCreate({ id: "9", name: "Iris" });
    });
    expect(screen.queryByText("saving...")).toBeNull();

    act(() => {
      void dataSet.delete();
    });
    expect(screen.getByText("deleting...")).toBeTruthy();
    await act(async () => {
      releaseRemove();
    });

    connector.remove = () => Promise.reject(new ConnectorError(500, "database down"));
    await act(async () => {
      await dataSet.delete().catch(() => undefined);
    });
    expect(screen.getByRole("alert")).toHaveTextContent("database down");
  });
});
