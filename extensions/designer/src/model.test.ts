import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { applyTextEdit, moveNode, parseTsx, validateEdit } from "./model";

const here = dirname(fileURLToPath(import.meta.url));
const helloApp = readFileSync(join(here, "../../../apps/hello/src/App.tsx"), "utf8");
const lockedFixture = readFileSync(join(here, "fixtures/locked.tsx.txt"), "utf8");

describe("parseTsx", () => {
  it("lists the hello app's elements in document order", () => {
    const model = parseTsx(helloApp);
    expect(model.component).toBe("App");
    expect(model.nodes.map((node) => `${node.depth}:${node.name}`)).toEqual([
      "0:main",
      "1:h1",
      "1:div",
      "2:TextInput",
      "2:Button",
      "2:Button",
      "1:ListBox",
    ]);
  });

  it("reads display on ListBox as a string prop with offsets inside the quotes", () => {
    const listBox = parseTsx(helloApp).nodes.find((node) => node.name === "ListBox");
    const display = listBox?.props.find((prop) => prop.name === "display");
    expect(display).toMatchObject({ kind: "string", value: "name" });
    expect(helloApp.slice(display?.start, display?.end)).toBe("name");
    const dataSet = listBox?.props.find((prop) => prop.name === "dataSet");
    expect(dataSet).toMatchObject({ kind: "expression", value: "names" });
  });

  it("records the source line of each node", () => {
    const listBox = parseTsx(helloApp).nodes.find((node) => node.name === "ListBox");
    expect(listBox?.lineText.trim()).toBe('<ListBox dataSet={names} display="name" />');
    expect(helloApp.split("\n")[(listBox?.line ?? 0) - 1]).toBe(listBox?.lineText);
  });

  it("locks map and ternary expressions and skips comments", () => {
    const nodes = parseTsx(lockedFixture).nodes;
    expect(nodes.map((node) => `${node.depth}:${node.kind}`)).toEqual([
      "0:element",
      "1:locked",
      "1:locked",
      "1:element",
    ]);
    expect(nodes[1]?.source).toContain("rows.map");
    expect(nodes[2]?.name).toContain("busy ?");
  });

  it("reads flags and spreads as read-only props", () => {
    const button = parseTsx(lockedFixture).nodes.find((node) => node.name === "button");
    expect(button?.props).toEqual([
      { name: "disabled", kind: "flag", value: "true" },
      { name: "...", kind: "expression", value: "rest" },
    ]);
  });

  it("finds a component when there is no default export", () => {
    expect(parseTsx(lockedFixture).component).toBe("Roster");
  });

  it("prefers the default export", () => {
    const text = `function Helper() { return <i />; }\nexport default function Page() { return <b />; }\n`;
    expect(parseTsx(text).component).toBe("Page");
  });

  it("returns no nodes for a file without JSX", () => {
    expect(parseTsx("export const x = 1;\n")).toEqual({ component: null, nodes: [] });
  });

  it("keeps node ids stable when an earlier prop changes length", () => {
    const before = parseTsx(helloApp).nodes.map((node) => node.id);
    const display = parseTsx(helloApp)
      .nodes.flatMap((node) => node.props)
      .find((prop) => prop.name === "display");
    const edited = applyTextEdit(helloApp, {
      start: display?.start ?? 0,
      end: display?.end ?? 0,
      newText: "a much longer field name",
    });
    expect(parseTsx(edited).nodes.map((node) => node.id)).toEqual(before);
  });
});

describe("edits", () => {
  const display = parseTsx(helloApp)
    .nodes.flatMap((node) => node.props)
    .find((prop) => prop.name === "display");
  const edit = { start: display?.start ?? -1, end: display?.end ?? -1, newText: "id" };

  it("changes exactly one line, only inside the quotes", () => {
    const after = applyTextEdit(helloApp, edit);
    const before = helloApp.split("\n");
    const lines = after.split("\n");
    expect(lines).toHaveLength(before.length);
    const changed = lines.flatMap((line, index) => (line === before[index] ? [] : [index]));
    expect(changed).toHaveLength(1);
    const index = changed[0] ?? 0;
    expect(before[index]?.trim()).toBe('<ListBox dataSet={names} display="name" />');
    expect(lines[index]?.trim()).toBe('<ListBox dataSet={names} display="id" />');
  });

  it("accepts an edit that matches a string prop", () => {
    expect(validateEdit(helloApp, edit)).toBeNull();
  });

  it("rejects an edit that does not match a string prop", () => {
    expect(validateEdit(helloApp, { ...edit, start: edit.start - 1 })).not.toBeNull();
  });

  it("rejects a value that would break the attribute", () => {
    expect(validateEdit(helloApp, { ...edit, newText: 'a"b' })).toMatch(/cannot contain/);
    expect(validateEdit(helloApp, { ...edit, newText: "a\nb" })).toMatch(/cannot contain/);
  });
});

describe("moveNode", () => {
  const names = (text: string) => parseTsx(text).nodes.map((node) => `${node.depth}:${node.name}`);
  const startOf = (text: string, name: string, nth = 0) =>
    parseTsx(text).nodes.filter((node) => node.name === name)[nth]?.start ?? -1;
  const apply = (text: string, edit: ReturnType<typeof moveNode>) => {
    if (typeof edit === "string") {
      throw new Error(edit);
    }
    return applyTextEdit(text, edit);
  };

  it("moves ListBox above the row of inputs", () => {
    const edit = moveNode(
      helloApp,
      startOf(helloApp, "ListBox"),
      startOf(helloApp, "div"),
      "before",
    );
    const after = apply(helloApp, edit);
    expect(names(after)).toEqual([
      "0:main",
      "1:h1",
      "1:ListBox",
      "1:div",
      "2:TextInput",
      "2:Button",
      "2:Button",
    ]);
    expect(after.length).toBe(helloApp.length);
    expect([...after].sort().join("")).toBe([...helloApp].sort().join(""));
  });

  it("swaps the two buttons, moving the multi-line Delete button before Add", () => {
    const edit = moveNode(
      helloApp,
      startOf(helloApp, "Button", 1),
      startOf(helloApp, "Button", 0),
      "before",
    );
    const after = apply(helloApp, edit);
    const buttons = parseTsx(after).nodes.filter((node) => node.name === "Button");
    expect(after.slice(buttons[0]?.start, buttons[0]?.end)).toContain("Delete");
    expect(after.slice(buttons[1]?.start, buttons[1]?.end)).toContain("Add");
  });

  it("moves after a sibling, and a move back restores the file exactly", () => {
    const moved = apply(
      helloApp,
      moveNode(helloApp, startOf(helloApp, "h1"), startOf(helloApp, "div"), "after"),
    );
    expect(names(moved).slice(0, 3)).toEqual(["0:main", "1:div", "2:TextInput"]);
    const back = apply(
      moved,
      moveNode(moved, startOf(moved, "h1"), startOf(moved, "div"), "before"),
    );
    expect(back).toBe(helloApp);
  });

  it("treats a drop inside a sibling as a drop next to that sibling", () => {
    const edit = moveNode(
      helloApp,
      startOf(helloApp, "ListBox"),
      startOf(helloApp, "Button"),
      "before",
    );
    expect(names(apply(helloApp, edit))).toEqual([
      "0:main",
      "1:h1",
      "1:ListBox",
      "1:div",
      "2:TextInput",
      "2:Button",
      "2:Button",
    ]);
  });

  it("refuses moves it cannot do cleanly", () => {
    expect(
      moveNode(helloApp, startOf(helloApp, "div"), startOf(helloApp, "Button"), "before"),
    ).toMatch(/into itself/);
    expect(
      moveNode(helloApp, startOf(helloApp, "main"), startOf(helloApp, "h1"), "before"),
    ).toMatch(/into itself/);
    expect(moveNode(helloApp, startOf(helloApp, "h1"), startOf(helloApp, "h1"), "after")).toMatch(
      /itself/,
    );
    expect(moveNode(helloApp, startOf(helloApp, "h1"), startOf(helloApp, "div"), "before")).toMatch(
      /already/,
    );
    const inline = "export function A() { return <p><b /><i /></p>; }\n";
    expect(moveNode(inline, inline.indexOf("<i"), inline.indexOf("<b"), "before")).toMatch(
      /own lines/,
    );
  });
});
