import "@testing-library/jest-dom/vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { createDataSet, memoryConnector } from "@jsctrls/react";
import { defineJcListBox } from "@jsctrls/elements";
import { beforeAll, describe, expect, it } from "vitest";
import { Site } from "./Site";

beforeAll(() => {
  defineJcListBox();
});

describe("Site", () => {
  it("drives both skins from one DataSet", async () => {
    const names = createDataSet({
      connector: memoryConnector([
        { id: "1", name: "Ada" },
        { id: "2", name: "Grace" },
      ]),
    });
    await act(async () => {
      render(<Site names={names} />);
      await names.open();
    });

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Data-aware React controls",
    );
    expect(screen.getByRole("link", { name: "Example app" })).toHaveAttribute("href", "/example/");

    expect(screen.getAllByRole("listbox")).toHaveLength(2);
    const react = screen.getAllByRole("listbox")[0] as HTMLElement;
    fireEvent.click(within(react).getByRole("option", { name: "Grace" }));

    // jc-listbox re-renders its children, so query it again after the click.
    const element = screen.getAllByRole("listbox")[1] as HTMLElement;
    expect(within(element).getByRole("option", { name: "Grace" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });
});
