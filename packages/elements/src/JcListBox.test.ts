// @vitest-environment jsdom

import { ConnectorError, createDataSet, memoryConnector, type Connector } from "@jsctrls/core";
import { listBoxMeta } from "@jsctrls/core/meta";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { defineJcListBox, JcListBox, LISTBOX_TAG } from "./JcListBox";

interface Name {
  id: string;
  name: string;
}

const seed = (): Name[] => [
  { id: "1", name: "Ada" },
  { id: "2", name: "Grace" },
  { id: "3", name: "Katherine" },
];

beforeAll(() => {
  defineJcListBox();
});

afterEach(() => {
  document.body.replaceChildren();
});

async function mount(connector: Connector<Name> = memoryConnector(seed())) {
  const dataSet = createDataSet({ connector });
  await dataSet.open();
  const element = document.createElement(LISTBOX_TAG) as JcListBox;
  element.setAttribute("display", "name");
  element.dataSet = dataSet as unknown as JcListBox["dataSet"];
  document.body.append(element);
  return { dataSet, element };
}

const options = (element: Element) => [...element.querySelectorAll('[role="option"]')];
const selected = (element: Element) =>
  element.querySelector('[role="option"][aria-selected="true"]')?.textContent;

describe("jc-listbox", () => {
  it("uses the tag from the ListBox meta", () => {
    expect(LISTBOX_TAG).toBe(listBoxMeta.tag);
    expect(customElements.get(LISTBOX_TAG)).toBe(JcListBox);
  });

  it("renders the rows and marks the current row", async () => {
    const { element } = await mount();
    expect(options(element).map((option) => option.textContent)).toEqual([
      "Ada",
      "Grace",
      "Katherine",
    ]);
    expect(selected(element)).toBe("Ada");
    expect(element.querySelector('[role="listbox"]')?.getAttribute("aria-activedescendant")).toBe(
      "jsctrls-option-1",
    );
  });

  it("moves the cursor on click and arrow keys", async () => {
    const { element } = await mount();
    (options(element)[1] as HTMLElement).click();
    expect(selected(element)).toBe("Grace");
    element
      .querySelector('[role="listbox"]')
      ?.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    expect(selected(element)).toBe("Katherine");
  });

  it("shows deleting and then the error", async () => {
    const connector: Connector<Name> = {
      ...memoryConnector(seed()),
      remove: () => Promise.reject(new ConnectorError(500, "database down")),
    };
    const { dataSet, element } = await mount(connector);
    const deleting = dataSet.delete().catch(() => undefined);
    expect(element.querySelector(".jsctrls-status")?.textContent).toBe("deleting...");
    await deleting;
    expect(element.querySelector('[role="alert"]')?.textContent).toBe("database down");
  });

  it("stops listening when removed from the page", async () => {
    const { dataSet, element } = await mount();
    element.remove();
    dataSet.locate("3");
    expect(selected(element)).toBe("Ada");
  });
});
