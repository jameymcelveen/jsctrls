import ts from "typescript";
import { controls } from "@jsctrls/core/meta";
import {
  bodyStatements,
  findComponent,
  isJsx,
  meaningfulChildren,
  parseTsx,
  stringChild,
  tagName,
  type Jsx,
  type TextEdit,
} from "./model";

/**
 * Edits the designer makes to a .tsx file. Each one reads the current text,
 * finds the element by its start offset, and returns the smallest text edits
 * that do the job. Nothing outside those spans changes, so undo, dirty state
 * and git diffs behave as if the user typed it. A string result is a message
 * for the user and means nothing was changed.
 */

/** How a prop is written: `name="text"`, `name={code}`, or a bare `name`. */
export type PropValue =
  | { readonly kind: "string"; readonly text: string }
  | { readonly kind: "expression"; readonly code: string }
  | { readonly kind: "flag" };

export interface Change {
  /** Non-overlapping edits against the current text, applied together. */
  readonly edits: readonly TextEdit[];
  /** Offset in the new text of an element to select. */
  readonly select?: number;
  /** Offset in the new text to show in the code editor. */
  readonly reveal?: number;
}

export type ControlName = (typeof controls)[number]["name"];

interface Parsed {
  readonly text: string;
  readonly file: ts.SourceFile;
}

function parse(text: string): Parsed {
  return {
    text,
    file: ts.createSourceFile(
      "component.tsx",
      text,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    ),
  };
}

function elementAt({ file }: Parsed, start: number): Jsx | undefined {
  const visit = (node: ts.Node): Jsx | undefined => {
    if (isJsx(node) && node.getStart(file) === start) {
      return node;
    }
    return ts.forEachChild(node, visit);
  };
  return visit(file);
}

function opening(node: ts.JsxElement | ts.JsxSelfClosingElement) {
  return ts.isJsxElement(node) ? node.openingElement : node;
}

function indentAt(text: string, offset: number): string {
  const lineStart = text.lastIndexOf("\n", offset - 1) + 1;
  return /^[ \t]*/.exec(text.slice(lineStart))?.[0] ?? "";
}

/** Apply edits given against the original text, in any order. */
export function applyEdits(text: string, edits: readonly TextEdit[]): string {
  return [...edits]
    .sort((a, b) => b.start - a.start)
    .reduce(
      (result, edit) => result.slice(0, edit.start) + edit.newText + result.slice(edit.end),
      text,
    );
}

/** Where an offset in the original text lands once the edits are applied. */
function shift(offset: number, edits: readonly TextEdit[]): number {
  return edits
    .filter((edit) => edit.end <= offset)
    .reduce((result, edit) => result + edit.newText.length - (edit.end - edit.start), offset);
}

const ATTRIBUTE_NAME = /^[A-Za-z_$][\w$]*(?:[-:][\w$]+)*$/;

/** Null when `code` is exactly one valid expression. */
export function checkExpression(code: string): string | null {
  if (code.trim() === "") {
    return "Write an expression, or clear the property.";
  }
  const file = ts.createSourceFile(
    "x.tsx",
    `(${code});`,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const diagnostics = (file as unknown as { parseDiagnostics?: readonly unknown[] })
    .parseDiagnostics;
  if ((diagnostics?.length ?? 0) > 0 || file.statements.length !== 1) {
    return `"${code}" is not a valid expression.`;
  }
  return null;
}

function attributeText(name: string, value: PropValue): string {
  if (value.kind === "flag") {
    return name;
  }
  if (value.kind === "expression") {
    return `${name}={${value.code}}`;
  }
  const { text } = value;
  if (/[\r\n]/.test(text) || (text.includes('"') && text.includes("'"))) {
    return `${name}={${JSON.stringify(text)}}`;
  }
  return text.includes('"') ? `${name}='${text}'` : `${name}="${text}"`;
}

/**
 * Set, change or remove (value null) one prop of an element. A new prop goes
 * after the last one, on its own line when the element lists its props one
 * per line.
 */
export function setProp(
  text: string,
  nodeStart: number,
  name: string,
  value: PropValue | null,
): Change | string {
  if (!ATTRIBUTE_NAME.test(name)) {
    return `"${name}" is not a valid prop name.`;
  }
  if (value?.kind === "expression") {
    const problem = checkExpression(value.code);
    if (problem) {
      return problem;
    }
  }
  const parsed = parse(text);
  const node = elementAt(parsed, nodeStart);
  if (!node || ts.isJsxFragment(node)) {
    return "The element is no longer in the file. Try again.";
  }
  const element = opening(node);
  const attributes = element.attributes.properties;
  const existing = attributes.find(
    (attribute): attribute is ts.JsxAttribute =>
      ts.isJsxAttribute(attribute) && attribute.name.getText() === name,
  );

  if (!value) {
    if (!existing) {
      return { edits: [] };
    }
    // From the end of the previous token, so the space or line before it goes too.
    return { edits: [{ start: existing.pos, end: existing.end, newText: "" }] };
  }
  const newText = attributeText(name, value);
  if (existing) {
    return { edits: [{ start: existing.getStart(parsed.file), end: existing.end, newText }] };
  }
  const last = attributes[attributes.length - 1];
  const after = last ?? element.typeArguments ?? element.tagName;
  const at = after.end;
  const { line: tagLine } = parsed.file.getLineAndCharacterOfPosition(element.tagName.getStart());
  const multiLine =
    last !== undefined &&
    parsed.file.getLineAndCharacterOfPosition(attributes[0]?.getStart() ?? 0).line !== tagLine;
  const separator = multiLine ? `\n${indentAt(text, last.getStart())}` : " ";
  return { edits: [{ start: at, end: at, newText: separator + newText }] };
}

function contentText(value: string): string {
  return /[{}<>\r\n]/.test(value) || value !== value.trim() ? `{${JSON.stringify(value)}}` : value;
}

/** Set the text between an element's tags. Only for elements whose content is plain text. */
export function setContent(text: string, nodeStart: number, value: string): Change | string {
  const parsed = parse(text);
  const node = elementAt(parsed, nodeStart);
  if (!node || ts.isJsxFragment(node)) {
    return "The element is no longer in the file. Try again.";
  }
  const written = value === "" ? "" : contentText(value);
  if (ts.isJsxSelfClosingElement(node)) {
    if (value === "") {
      return { edits: [] };
    }
    const lastAttribute = node.attributes.properties[node.attributes.properties.length - 1];
    const from = (lastAttribute ?? node.typeArguments ?? node.tagName).end;
    return {
      edits: [{ start: from, end: node.end, newText: `>${written}</${tagName(node)}>` }],
    };
  }
  const children = meaningfulChildren(node);
  const first = children[0];
  const last = children[children.length - 1];
  if (!first || !last) {
    const at = node.closingElement.getStart(parsed.file);
    return { edits: [{ start: at, end: at, newText: written }] };
  }
  const allText = children.every((child) => ts.isJsxText(child));
  if (!allText && !(children.length === 1 && stringChild(first) !== undefined)) {
    return "This element holds other elements or code. Edit it in code.";
  }
  let start = first.getStart(parsed.file);
  let end = last.end;
  if (allText) {
    // Keep the whitespace and line breaks around the text as they are.
    const raw = text.slice(start, end);
    start += raw.length - raw.trimStart().length;
    end -= raw.length - raw.trimEnd().length;
  }
  return { edits: [{ start, end, newText: written }] };
}

function identifiersIn(file: ts.SourceFile): Set<string> {
  const names = new Set<string>();
  const visit = (node: ts.Node) => {
    if (ts.isIdentifier(node)) {
      names.add(node.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return names;
}

function pascal(words: string): string {
  return words
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join("");
}

/**
 * Create an empty handler for an event, the way Delphi's double-click on an
 * event does: `const handleAddClick = () => {};` goes in the component body
 * just before its return, and the prop names it.
 */
export function createHandler(text: string, nodeStart: number, event: string): Change | string {
  const parsed = parse(text);
  const node = elementAt(parsed, nodeStart);
  const found = findComponent(parsed.file);
  if (!node || ts.isJsxFragment(node) || !found) {
    return "The element is no longer in the file. Try again.";
  }
  const returnStatement = bodyStatements(found.fn).find(
    (statement) =>
      ts.isReturnStatement(statement) &&
      statement.getStart() <= found.jsx.getStart() &&
      found.jsx.end <= statement.end,
  );
  if (!returnStatement) {
    return "The component has no function body to put a handler in. Give it a body with a return first.";
  }
  const model = parseTsx(text);
  const content = model.nodes.find((candidate) => candidate.start === nodeStart)?.content;
  const label = content?.kind === "text" && /[A-Za-z]/.test(content.value) ? content.value : "";
  const base = `handle${pascal(label) || tagName(node)}${pascal(event.replace(/^on/, ""))}`;
  const taken = identifiersIn(parsed.file);
  let name = base;
  for (let n = 2; taken.has(name); n += 1) {
    name = `${base}${n}`;
  }
  const at = text.lastIndexOf("\n", returnStatement.getStart(parsed.file) - 1) + 1;
  const indent = indentAt(text, returnStatement.getStart(parsed.file));
  const declaration = `${indent}const ${name} = () => {\n${indent}};\n\n`;
  const prop = setProp(text, nodeStart, event, { kind: "expression", code: name });
  if (typeof prop === "string") {
    return prop;
  }
  const edits = [{ start: at, end: at, newText: declaration }, ...prop.edits];
  // The prop edit is after the return, so it does not move the declaration.
  return { edits, reveal: shift(at, prop.edits) + declaration.indexOf("{") + 1 };
}

/** Add `name` to the `@jsctrls/react` import, keeping the list's order and layout. */
function importEdit(parsed: Parsed, name: string): TextEdit | null {
  const imports = parsed.file.statements.filter(ts.isImportDeclaration);
  const library = imports.find(
    (statement) =>
      ts.isStringLiteral(statement.moduleSpecifier) &&
      statement.moduleSpecifier.text === "@jsctrls/react" &&
      !statement.importClause?.isTypeOnly &&
      statement.importClause?.namedBindings &&
      ts.isNamedImports(statement.importClause.namedBindings),
  );
  const bindings = library?.importClause?.namedBindings;
  if (!library || !bindings || !ts.isNamedImports(bindings)) {
    const lastImport = imports[imports.length - 1];
    const at = lastImport ? lastImport.end : 0;
    const line = `import { ${name} } from "@jsctrls/react";`;
    return { start: at, end: at, newText: lastImport ? `\n${line}` : `${line}\n` };
  }
  const elements = bindings.elements;
  if (elements.some((element) => element.name.text === name)) {
    return null;
  }
  const next = elements.find(
    (element) => element.name.text.localeCompare(name, "en", { sensitivity: "base" }) > 0,
  );
  const first = elements[0];
  const multiLine =
    first !== undefined &&
    parsed.file.getLineAndCharacterOfPosition(first.getStart()).line !==
      parsed.file.getLineAndCharacterOfPosition(bindings.getStart()).line;
  if (next) {
    const at = next.getStart(parsed.file);
    const separator = multiLine ? `\n${indentAt(parsed.text, at)}` : " ";
    return { start: at, end: at, newText: `${name},${separator}` };
  }
  const last = elements[elements.length - 1];
  if (!last) {
    const at = bindings.getStart(parsed.file) + 1;
    return { start: at, end: at, newText: ` ${name} ` };
  }
  const separator = multiLine ? `\n${indentAt(parsed.text, last.getStart())}` : " ";
  return { start: last.end, end: last.end, newText: `,${separator}${name}` };
}

/** The JSX the palette writes for a control: its required props and default content. */
export function controlJsx(control: ControlName, text: string): string | { problem: string } {
  const meta = controls.find((candidate) => candidate.name === control);
  if (!meta) {
    return { problem: `${control} is not in the palette.` };
  }
  const model = parseTsx(text);
  const dataSet = model.dataSets[0];
  const props: string[] = [];
  let content: string | undefined;
  for (const property of meta.properties) {
    const required = "required" in property && property.required === true;
    if (property.kind === "content") {
      content = String(property.default ?? meta.name);
    } else if (!required) {
      continue;
    } else if (property.kind === "dataSet") {
      if (!dataSet) {
        return {
          problem: `${meta.name} binds to a DataSet. Declare one in this file with createDataSet first.`,
        };
      }
      props.push(`${property.name}={${dataSet.name}}`);
    } else if (property.kind === "field") {
      const field =
        dataSet?.fields.find(
          (candidate) => candidate.name !== "id" && candidate.type === "string",
        ) ?? dataSet?.fields[0];
      props.push(`${property.name}="${field?.name ?? "id"}"`);
    } else if (property.kind === "event") {
      props.push(`${property.name}={() => {}}`);
    } else {
      props.push(
        attributeText(property.name, { kind: "string", text: String(property.default ?? "") }),
      );
    }
  }
  const open = [meta.name, ...props].join(" ");
  return content === undefined ? `<${open} />` : `<${open}>${content}</${meta.name}>`;
}

/**
 * Insert a control from the palette. Into the selected element when it is a
 * plain HTML container (a div, main, form), else right after the selected
 * element, else at the end of the component's root. The import is added too.
 */
export function insertControl(
  text: string,
  anchorStart: number | null,
  control: ControlName,
): Change | string {
  const jsx = controlJsx(control, text);
  if (typeof jsx !== "string") {
    return jsx.problem;
  }
  const parsed = parse(text);
  const found = findComponent(parsed.file);
  if (!found) {
    return "No component with JSX was found in this file.";
  }
  const anchor = anchorStart === null ? found.jsx : elementAt(parsed, anchorStart);
  if (!anchor) {
    return "The selected element is no longer in the file. Select it again.";
  }
  const isContainer = (node: Jsx): node is ts.JsxElement | ts.JsxFragment =>
    ts.isJsxFragment(node) ||
    (ts.isJsxElement(node) &&
      /^[a-z]/.test(tagName(node)) &&
      !meaningfulChildren(node).some((child) => ts.isJsxText(child)));

  let edit: TextEdit;
  let elementOffset: number;
  if (isContainer(anchor)) {
    const closing = ts.isJsxFragment(anchor) ? anchor.closingFragment : anchor.closingElement;
    const closeAt = closing.getStart(parsed.file);
    const closeIndent = indentAt(text, closeAt);
    const lineStart = text.lastIndexOf("\n", closeAt - 1) + 1;
    const children = meaningfulChildren(anchor);
    const lastChild = children[children.length - 1];
    const childIndent = lastChild
      ? indentAt(text, lastChild.getStart(parsed.file))
      : `${closeIndent}  `;
    if (text.slice(lineStart, closeAt).trim() === "") {
      edit = { start: lineStart, end: lineStart, newText: `${childIndent}${jsx}\n` };
      elementOffset = lineStart + childIndent.length;
    } else {
      edit = { start: closeAt, end: closeAt, newText: `\n${childIndent}${jsx}\n${closeIndent}` };
      elementOffset = closeAt + 1 + childIndent.length;
    }
  } else if (anchor === found.jsx) {
    return "Select a container (a div or main) to put the control in.";
  } else {
    const indent = indentAt(text, anchor.getStart(parsed.file));
    const lineEnd = text.indexOf("\n", anchor.end);
    const ownLine = text.slice(anchor.end, lineEnd === -1 ? text.length : lineEnd).trim() === "";
    if (ownLine && lineEnd !== -1) {
      edit = { start: lineEnd + 1, end: lineEnd + 1, newText: `${indent}${jsx}\n` };
      elementOffset = lineEnd + 1 + indent.length;
    } else {
      edit = { start: anchor.end, end: anchor.end, newText: `\n${indent}${jsx}` };
      elementOffset = anchor.end + 1 + indent.length;
    }
  }
  const imported = importEdit(parsed, control);
  const edits = imported ? [imported, edit] : [edit];
  return { edits, select: shift(elementOffset, imported ? [imported] : []) };
}
