import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  applyEdits,
  checkExpression,
  controlJsx,
  createHandler,
  insertControl,
  setContent,
  setProp,
  type Change,
} from "./edits";
import { parseTsx } from "./model";

const here = dirname(fileURLToPath(import.meta.url));
const helloApp = readFileSync(join(here, "../../../apps/hello/src/App.tsx"), "utf8");

const startOf = (text: string, name: string, nth = 0) =>
  parseTsx(text).nodes.filter((node) => node.name === name)[nth]?.start ?? -1;

function apply(text: string, change: Change | string): string {
  if (typeof change === "string") {
    throw new Error(change);
  }
  return applyEdits(text, change.edits);
}

/** The lines that differ, as [before, after] pairs, for files with the same line count. */
function changedLines(before: string, after: string): string[] {
  const a = before.split("\n");
  return after.split("\n").flatMap((line, index) => (line === a[index] ? [] : [line.trim()]));
}

describe("setProp", () => {
  it("changes a string prop and nothing else", () => {
    const after = apply(
      helloApp,
      setProp(helloApp, startOf(helloApp, "ListBox"), "display", { kind: "string", text: "id" }),
    );
    expect(changedLines(helloApp, after)).toEqual(['<ListBox dataSet={names} display="id" />']);
  });

  it("adds a prop after the last one on a one-line element", () => {
    const after = apply(
      helloApp,
      setProp(helloApp, startOf(helloApp, "TextInput"), "placeholder", {
        kind: "string",
        text: "Type a name",
      }),
    );
    expect(changedLines(helloApp, after)).toEqual([
      '<TextInput value={text} onChange={setText} aria-label="Name" placeholder="Type a name" />',
    ]);
  });

  it("adds a prop on its own line when the element lists one per line", () => {
    const after = apply(
      helloApp,
      setProp(helloApp, startOf(helloApp, "Button"), "type", { kind: "string", text: "submit" }),
    );
    const lines = after.split("\n");
    const at = lines.findIndex((line) => line.trim() === 'type="submit"');
    expect(lines[at - 1]?.trim()).toBe("}}");
    expect(lines[at + 1]?.trim()).toBe(">");
    expect(lines[at]).toBe(`${/^\s*/.exec(lines[at - 1] ?? "")?.[0] ?? ""}type="submit"`);
  });

  it("removes a prop with the space before it", () => {
    const after = apply(
      helloApp,
      setProp(helloApp, startOf(helloApp, "TextInput"), "aria-label", null),
    );
    expect(changedLines(helloApp, after)).toEqual([
      "<TextInput value={text} onChange={setText} />",
    ]);
  });

  it("removes a prop that sits on its own line, and the line with it", () => {
    const after = apply(
      helloApp,
      setProp(helloApp, startOf(helloApp, "Button", 1), "disabled", null),
    );
    expect(after.split("\n")).toHaveLength(helloApp.split("\n").length - 1);
    expect(
      parseTsx(after)
        .nodes.filter((node) => node.name === "Button")[1]
        ?.props.map((p) => p.name),
    ).toEqual(["onClick"]);
  });

  it("writes flags, expressions, and strings that hold quotes", () => {
    const button = startOf(helloApp, "ListBox");
    const write = (value: Parameters<typeof setProp>[3]) =>
      changedLines(helloApp, apply(helloApp, setProp(helloApp, button, "title", value)))[0];
    expect(write({ kind: "flag" })).toBe('<ListBox dataSet={names} display="name" title />');
    expect(write({ kind: "expression", code: "names.title" })).toContain("title={names.title}");
    expect(write({ kind: "string", text: 'say "hi"' })).toContain(`title='say "hi"'`);
    expect(write({ kind: "string", text: `it's "x"` })).toContain(`title={"it's \\"x\\""}`);
  });

  it("refuses code that is not one expression, and bad prop names", () => {
    const listBox = startOf(helloApp, "ListBox");
    expect(setProp(helloApp, listBox, "dataSet", { kind: "expression", code: "a}{b" })).toMatch(
      /not a valid expression/,
    );
    expect(setProp(helloApp, listBox, "bad name", { kind: "flag" })).toMatch(/not a valid prop/);
    expect(checkExpression("names")).toBeNull();
    expect(checkExpression("() => { save(); }")).toBeNull();
    expect(checkExpression("a; b")).not.toBeNull();
  });

  it("keeps the file parseable and the element ids stable", () => {
    const before = parseTsx(helloApp).nodes.map((node) => node.id);
    const after = apply(
      helloApp,
      setProp(helloApp, startOf(helloApp, "ListBox"), "display", { kind: "string", text: "id" }),
    );
    expect(parseTsx(after).nodes.map((node) => node.id)).toEqual(before);
  });
});

describe("setContent", () => {
  it("changes a button's text and keeps the lines around it", () => {
    const after = apply(helloApp, setContent(helloApp, startOf(helloApp, "Button"), "Add name"));
    expect(changedLines(helloApp, after)).toEqual(["Add name"]);
  });

  it("changes a one-line heading", () => {
    const after = apply(helloApp, setContent(helloApp, startOf(helloApp, "h1"), "People"));
    expect(changedLines(helloApp, after)).toEqual(["<h1>People</h1>"]);
  });

  it("writes text with braces as a string literal", () => {
    const after = apply(helloApp, setContent(helloApp, startOf(helloApp, "h1"), "a {b}"));
    expect(changedLines(helloApp, after)).toEqual(['<h1>{"a {b}"}</h1>']);
    expect(parseTsx(after).nodes.find((node) => node.name === "h1")?.content).toEqual({
      kind: "text",
      value: "a {b}",
    });
  });

  it("opens a self-closing element to give it text", () => {
    const text = "export function P() {\n  return <Button disabled />;\n}\n";
    const after = apply(text, setContent(text, startOf(text, "Button"), "Go"));
    expect(after).toContain("<Button disabled>Go</Button>");
  });

  it("refuses an element that holds other elements", () => {
    expect(setContent(helloApp, startOf(helloApp, "div"), "x")).toMatch(/Edit it in code/);
  });
});

describe("createHandler", () => {
  it("adds an empty handler before the return and names it in the prop", () => {
    const text = `export function P() {
  const x = 1;

  return (
    <main>
      <Button>Save</Button>
    </main>
  );
}
`;
    const change = createHandler(text, startOf(text, "Button"), "onClick");
    const after = apply(text, change);
    expect(after).toBe(`export function P() {
  const x = 1;

  const handleSaveClick = () => {
  };

  return (
    <main>
      <Button onClick={handleSaveClick}>Save</Button>
    </main>
  );
}
`);
    expect(typeof change !== "string" && after.slice(0, change.reveal)).toMatch(
      /const handleSaveClick = \(\) => \{$/,
    );
    expect(parseTsx(after).handlers.map((handler) => handler.name)).toContain("handleSaveClick");
  });

  it("picks a name that is not taken", () => {
    const text = `export function P() {
  const handleSaveClick = () => {};
  return <Button>Save</Button>;
}
`;
    expect(apply(text, createHandler(text, startOf(text, "Button"), "onClick"))).toContain(
      "onClick={handleSaveClick2}",
    );
  });

  it("refuses a component without a function body", () => {
    const text = "export const P = () => <Button>Go</Button>;\n";
    expect(createHandler(text, startOf(text, "Button"), "onClick")).toMatch(/no function body/);
  });
});

describe("insertControl", () => {
  it("writes a control's required props from its meta", () => {
    expect(controlJsx("Button", helloApp)).toBe("<Button>Button</Button>");
    expect(controlJsx("TextInput", helloApp)).toBe('<TextInput value="" onChange={() => {}} />');
    expect(controlJsx("ListBox", helloApp)).toBe('<ListBox dataSet={names} display="name" />');
    expect(controlJsx("DataNavigator", helloApp)).toBe("<DataNavigator dataSet={names} />");
  });

  it("refuses a data-aware control when the file has no DataSet", () => {
    const text = "export function P() {\n  return <main></main>;\n}\n";
    expect(insertControl(text, null, "ListBox")).toMatch(/Declare one in this file/);
  });

  it("adds a control at the end of the selected container, and its import", () => {
    const change = insertControl(helloApp, startOf(helloApp, "div"), "DataNavigator");
    const after = apply(helloApp, change);
    const lines = after.split("\n");
    const at = lines.findIndex((line) => line.trim() === "<DataNavigator dataSet={names} />");
    expect(lines[at + 1]?.trim()).toBe("</div>");
    expect(lines[at]).toBe(`        <DataNavigator dataSet={names} />`);
    expect(after).toMatch(
      /import \{\n {2}Button,\n {2}createDataSet,\n {2}DataNavigator,\n {2}ListBox,/,
    );
    // The new element is selected.
    const selected = parseTsx(after).nodes.find(
      (node) => typeof change !== "string" && node.start === change.select,
    );
    expect(selected?.name).toBe("DataNavigator");
  });

  it("adds a control after a selected control, on its own line", () => {
    const after = apply(helloApp, insertControl(helloApp, startOf(helloApp, "ListBox"), "Button"));
    const names = parseTsx(after).nodes.map((node) => `${node.depth}:${node.name}`);
    expect(names.slice(-2)).toEqual(["1:ListBox", "1:Button"]);
    expect(after).toContain(
      '      <ListBox dataSet={names} display="name" />\n      <Button>Button</Button>\n',
    );
  });

  it("adds into the root when nothing is selected", () => {
    const after = apply(helloApp, insertControl(helloApp, null, "Button"));
    const names = parseTsx(after).nodes.map((node) => `${node.depth}:${node.name}`);
    expect(names.at(-1)).toBe("1:Button");
  });

  it("does not import a control twice", () => {
    const after = apply(helloApp, insertControl(helloApp, null, "Button"));
    expect(after.match(/\bButton,/g)).toHaveLength(1);
  });

  it("adds an import line when the file does not import jsctrls yet", () => {
    const text = `import { useState } from "react";

export function P() {
  return <main></main>;
}
`;
    const change = insertControl(text, null, "Button");
    const after = apply(text, change);
    expect(after).toContain(
      'import { useState } from "react";\nimport { Button } from "@jsctrls/react";\n',
    );
    expect(after).toContain("<main>\n    <Button>Button</Button>\n  </main>");
    const selected = parseTsx(after).nodes.find(
      (node) => typeof change !== "string" && node.start === change.select,
    );
    expect(selected?.name).toBe("Button");
  });
});
