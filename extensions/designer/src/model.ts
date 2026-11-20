import ts from "typescript";

/** How a prop's value is written in the source. */
export type PropKind = "string" | "expression" | "flag";

export interface DesignProp {
  readonly name: string;
  readonly kind: PropKind;
  /** The value as written: the text inside the quotes, the expression source, or "true". */
  readonly value: string;
  /** Start offset of the whole attribute, to show it in code. */
  readonly at: number;
  /** For "string" props: offsets of the text inside the quotes. */
  readonly start?: number;
  readonly end?: number;
}

export interface DesignNode {
  /** Path of child indexes from the root, e.g. "0.1.2". Stable across edits elsewhere. */
  readonly id: string;
  readonly depth: number;
  readonly kind: "element" | "locked";
  /** Tag name for elements; the first line of source for locked blocks. */
  readonly name: string;
  readonly start: number;
  readonly end: number;
  /** 1-based line number and the text of that line. */
  readonly line: number;
  readonly lineText: string;
  readonly props: readonly DesignProp[];
  /**
   * What sits between the tags. "text" is plain text (or a string literal in
   * braces, or nothing yet) and can be edited; "children" means elements or
   * code, edited elsewhere.
   */
  readonly content?:
    { readonly kind: "text"; readonly value: string } | { readonly kind: "children" };
  /** Full source for locked blocks. */
  readonly source?: string;
}

/** A DataSet the file declares: `const names = createDataSet<{ id: string; name: string }>(...)`. */
export interface DesignDataSet {
  readonly name: string;
  /** Fields read from the type argument, when the file spells the row type out. */
  readonly fields: readonly { readonly name: string; readonly type: string }[];
}

/** A function in scope that an event prop can name, with where it is declared. */
export interface DesignHandler {
  readonly name: string;
  readonly start: number;
}

export interface DesignModel {
  readonly component: string | null;
  readonly nodes: readonly DesignNode[];
  readonly dataSets: readonly DesignDataSet[];
  readonly handlers: readonly DesignHandler[];
}

export interface TextEdit {
  readonly start: number;
  readonly end: number;
  readonly newText: string;
}

/** Parse a .tsx file and list the JSX of its component, in document order. */
export function parseTsx(text: string, fileName = "component.tsx"): DesignModel {
  const file = ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const found = findComponent(file);
  if (!found) {
    return { component: null, nodes: [], dataSets: [], handlers: [] };
  }
  const nodes: DesignNode[] = [];
  walk(file, found.jsx, "0", 0, nodes);
  return {
    component: found.name,
    nodes,
    dataSets: findDataSets(file, found),
    handlers: findHandlers(file, found),
  };
}

/** Replace one span of text. Everything outside [start, end) is left byte for byte. */
export function applyTextEdit(text: string, edit: TextEdit): string {
  return text.slice(0, edit.start) + edit.newText + text.slice(edit.end);
}

export type Jsx = ts.JsxElement | ts.JsxSelfClosingElement | ts.JsxFragment;

export function isJsx(node: ts.Node): node is Jsx {
  return ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node) || ts.isJsxFragment(node);
}

function unwrap(node: ts.Node | undefined): ts.Node | undefined {
  let current = node;
  while (current && ts.isParenthesizedExpression(current)) {
    current = current.expression;
  }
  return current;
}

/** The first JSX value returned by a function body, not counting nested functions. */
function returnedJsx(body: ts.Node | undefined): Jsx | undefined {
  const direct = unwrap(body);
  if (direct && isJsx(direct)) {
    return direct;
  }
  let found: Jsx | undefined;
  const visit = (node: ts.Node): void => {
    if (found || ts.isFunctionLike(node)) {
      return;
    }
    if (ts.isReturnStatement(node)) {
      const value = unwrap(node.expression);
      if (value && isJsx(value)) {
        found = value;
        return;
      }
    }
    ts.forEachChild(node, visit);
  };
  if (body) {
    ts.forEachChild(body, visit);
  }
  return found;
}

export interface Candidate {
  readonly name: string;
  readonly jsx: Jsx;
  readonly isDefault: boolean;
  /** The component function, to find what its body declares. */
  readonly fn: ts.FunctionLikeDeclaration;
}

export function findComponent(file: ts.SourceFile): Candidate | undefined {
  const candidates: Candidate[] = [];
  let defaultName: string | undefined;

  for (const statement of file.statements) {
    const modifiers = ts.canHaveModifiers(statement) ? ts.getModifiers(statement) : undefined;
    const isDefault = Boolean(modifiers?.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword));
    if (ts.isFunctionDeclaration(statement)) {
      const jsx = returnedJsx(statement.body);
      if (jsx) {
        candidates.push({ name: statement.name?.text ?? "default", jsx, isDefault, fn: statement });
      }
    } else if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        const init = unwrap(declaration.initializer);
        if (init && (ts.isArrowFunction(init) || ts.isFunctionExpression(init))) {
          const jsx = returnedJsx(init.body);
          if (jsx && ts.isIdentifier(declaration.name)) {
            candidates.push({ name: declaration.name.text, jsx, isDefault: false, fn: init });
          }
        }
      }
    } else if (ts.isExportAssignment(statement)) {
      const expression = unwrap(statement.expression);
      if (expression && ts.isIdentifier(expression)) {
        defaultName = expression.text;
      } else if (
        expression &&
        (ts.isArrowFunction(expression) || ts.isFunctionExpression(expression))
      ) {
        const jsx = returnedJsx(expression.body);
        if (jsx) {
          candidates.push({ name: "default", jsx, isDefault: true, fn: expression });
        }
      }
    }
  }

  return (
    candidates.find((candidate) => candidate.isDefault) ??
    candidates.find((candidate) => candidate.name === defaultName) ??
    candidates.find((candidate) => /^[A-Z]/.test(candidate.name)) ??
    candidates[0]
  );
}

export function tagName(node: Jsx): string {
  if (ts.isJsxFragment(node)) {
    return "Fragment";
  }
  const tag = ts.isJsxElement(node) ? node.openingElement.tagName : node.tagName;
  return tag.getText();
}

function propsOf(node: Jsx): DesignProp[] {
  if (ts.isJsxFragment(node)) {
    return [];
  }
  const attributes = ts.isJsxElement(node)
    ? node.openingElement.attributes.properties
    : node.attributes.properties;
  return attributes.map((attribute): DesignProp => {
    if (ts.isJsxSpreadAttribute(attribute)) {
      return {
        name: "...",
        kind: "expression",
        value: attribute.expression.getText(),
        at: attribute.getStart(),
      };
    }
    const at = attribute.getStart();
    const name = attribute.name.getText();
    const init = attribute.initializer;
    if (!init) {
      return { name, kind: "flag", value: "true", at };
    }
    if (ts.isStringLiteral(init)) {
      const start = init.getStart() + 1;
      const end = init.getEnd() - 1;
      return {
        name,
        kind: "string",
        value: init.getSourceFile().text.slice(start, end),
        at,
        start,
        end,
      };
    }
    const value = ts.isJsxExpression(init) ? (init.expression?.getText() ?? "") : init.getText();
    return { name, kind: "expression", value, at };
  });
}

function location(node: ts.Node): { line: number; lineText: string } {
  const file = node.getSourceFile();
  const { line } = file.getLineAndCharacterOfPosition(node.getStart());
  const lineStart = file.getPositionOfLineAndCharacter(line, 0);
  const lineEnd = file.text.indexOf("\n", lineStart);
  return {
    line: line + 1,
    lineText: file.text.slice(lineStart, lineEnd === -1 ? undefined : lineEnd).replace(/\r$/, ""),
  };
}

function walk(file: ts.SourceFile, node: Jsx, id: string, depth: number, out: DesignNode[]): void {
  out.push({
    id,
    depth,
    kind: "element",
    name: tagName(node),
    start: node.getStart(file),
    end: node.getEnd(),
    ...location(node),
    props: propsOf(node),
    content: contentOf(node),
  });
  if (ts.isJsxSelfClosingElement(node)) {
    return;
  }
  let index = 0;
  for (const child of node.children) {
    if (ts.isJsxText(child) || (ts.isJsxExpression(child) && !child.expression)) {
      continue;
    }
    const childId = `${id}.${index}`;
    index += 1;
    if (isJsx(child)) {
      walk(file, child, childId, depth + 1, out);
    } else {
      const source = child.getText(file);
      out.push({
        id: childId,
        depth: depth + 1,
        kind: "locked",
        name: source.split("\n")[0] ?? source,
        start: child.getStart(file),
        end: child.getEnd(),
        ...location(child),
        props: [],
        source,
      });
    }
  }
}

export type MovePosition = "before" | "after";

/**
 * Move one JSX child before or after a sibling under the same parent.
 * Returns a single edit that rewrites only the span covering both, so one
 * undo puts it back, or an error message. v1 rules: same parent, and both
 * nodes sit on their own lines (the whole lines move).
 */
export function moveNode(
  text: string,
  fromStart: number,
  toStart: number,
  position: MovePosition,
): TextEdit | string {
  const nodes = parseTsx(text).nodes;
  const parentOf = (id: string) => id.slice(0, Math.max(0, id.lastIndexOf(".")));
  const from = nodes.find((node) => node.start === fromStart);
  const dropped = nodes.find((node) => node.start === toStart);
  if (!from || !dropped) {
    return "The element is no longer in the file. Try again.";
  }
  if (from === dropped) {
    return "An element cannot move onto itself.";
  }
  // A drop on something inside a sibling (an input in a row) means next to that sibling.
  let to: DesignNode | undefined = dropped;
  while (to && to.depth > 0 && parentOf(to.id) !== parentOf(from.id)) {
    const parentId = parentOf(to.id);
    to = nodes.find((node) => node.id === parentId);
  }
  if (!to || to === from) {
    return "An element cannot move into itself.";
  }
  if (from.depth === 0 || parentOf(from.id) !== parentOf(to.id)) {
    return "Move works between siblings in the same parent for now.";
  }
  const fromLines = ownLines(text, from);
  const toLines = ownLines(text, to);
  if (!fromLines || !toLines) {
    return "Move works when each element is on its own lines.";
  }
  const insertAt = position === "before" ? toLines.start : toLines.end;
  if (insertAt === fromLines.start || insertAt === fromLines.end) {
    return "The element is already there.";
  }
  const block = text.slice(fromLines.start, fromLines.end);
  const regionStart = Math.min(fromLines.start, insertAt);
  const regionEnd = Math.max(fromLines.end, insertAt);
  const region = text.slice(regionStart, regionEnd);
  const cutStart = fromLines.start - regionStart;
  const cutEnd = fromLines.end - regionStart;
  const without = region.slice(0, cutStart) + region.slice(cutEnd);
  const insert =
    insertAt <= fromLines.start ? insertAt - regionStart : insertAt - regionStart - block.length;
  const newText = without.slice(0, insert) + block + without.slice(insert);
  return { start: regionStart, end: regionEnd, newText };
}

/** The full lines a node occupies, when nothing else shares them. */
function ownLines(text: string, node: DesignNode): { start: number; end: number } | null {
  const start = text.lastIndexOf("\n", node.start - 1) + 1;
  if (text.slice(start, node.start).trim() !== "") {
    return null;
  }
  const newline = text.indexOf("\n", node.end);
  const lineEnd = newline === -1 ? text.length : newline;
  if (text.slice(node.end, lineEnd).trim() !== "") {
    return null;
  }
  return { start, end: newline === -1 ? text.length : newline + 1 };
}

/** Children that matter: not whitespace-only text and not empty braces or comments. */
export function meaningfulChildren(node: ts.JsxElement | ts.JsxFragment): ts.JsxChild[] {
  return node.children.filter(
    (child) =>
      !(ts.isJsxText(child) && child.containsOnlyTriviaWhiteSpaces) &&
      !(ts.isJsxExpression(child) && !child.expression),
  );
}

/** The string a `{"text"}` child holds, or undefined for any other child. */
export function stringChild(child: ts.JsxChild): string | undefined {
  if (!ts.isJsxExpression(child) || !child.expression) {
    return undefined;
  }
  const expression = unwrap(child.expression);
  return expression &&
    (ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression))
    ? expression.text
    : undefined;
}

function contentOf(node: Jsx): NonNullable<DesignNode["content"]> {
  if (ts.isJsxSelfClosingElement(node)) {
    return { kind: "text", value: "" };
  }
  const children = meaningfulChildren(node);
  if (children.length === 0) {
    return { kind: "text", value: "" };
  }
  if (children.every((child) => ts.isJsxText(child))) {
    return {
      kind: "text",
      value: children
        .map((child) => child.getText())
        .join("")
        .trim(),
    };
  }
  const only = children.length === 1 ? children[0] : undefined;
  const literal = only ? stringChild(only) : undefined;
  return literal === undefined ? { kind: "children" } : { kind: "text", value: literal };
}

/** Statements at the top of the component body, or none for an expression body. */
export function bodyStatements(fn: ts.FunctionLikeDeclaration): readonly ts.Statement[] {
  return fn.body && ts.isBlock(fn.body) ? fn.body.statements : [];
}

/** Variable declarations at module level and at the top of the component body. */
function declarationsInScope(file: ts.SourceFile, found: Candidate): ts.VariableDeclaration[] {
  return [...file.statements, ...bodyStatements(found.fn)]
    .filter(ts.isVariableStatement)
    .flatMap((statement) => [...statement.declarationList.declarations]);
}

function findCall(node: ts.Node, name: string): ts.CallExpression | undefined {
  if (ts.isCallExpression(node) && node.expression.getText() === name) {
    return node;
  }
  return ts.forEachChild(node, (child) => findCall(child, name));
}

function fieldsOf(file: ts.SourceFile, type: ts.TypeNode | undefined): DesignDataSet["fields"] {
  let members: ts.NodeArray<ts.TypeElement> | undefined;
  if (type && ts.isTypeLiteralNode(type)) {
    members = type.members;
  } else if (type && ts.isTypeReferenceNode(type)) {
    const name = type.typeName.getText();
    for (const statement of file.statements) {
      if (ts.isInterfaceDeclaration(statement) && statement.name.text === name) {
        members = statement.members;
      } else if (
        ts.isTypeAliasDeclaration(statement) &&
        statement.name.text === name &&
        ts.isTypeLiteralNode(statement.type)
      ) {
        members = statement.type.members;
      }
    }
  }
  const fields: { name: string; type: string }[] = [];
  for (const member of members ?? []) {
    if (ts.isPropertySignature(member)) {
      fields.push({ name: member.name.getText(), type: member.type?.getText() ?? "unknown" });
    }
  }
  return fields;
}

function findDataSets(file: ts.SourceFile, found: Candidate): DesignDataSet[] {
  const dataSets: DesignDataSet[] = [];
  for (const declaration of declarationsInScope(file, found)) {
    const call = declaration.initializer && findCall(declaration.initializer, "createDataSet");
    if (call && ts.isIdentifier(declaration.name)) {
      dataSets.push({
        name: declaration.name.text,
        fields: fieldsOf(file, call.typeArguments?.[0]),
      });
    }
  }
  return dataSets;
}

function findHandlers(file: ts.SourceFile, found: Candidate): DesignHandler[] {
  const handlers: DesignHandler[] = [];
  const add = (name: ts.Identifier) => {
    if (name.text !== found.name) {
      handlers.push({ name: name.text, start: name.getStart(file) });
    }
  };
  for (const statement of [...file.statements, ...bodyStatements(found.fn)]) {
    if (ts.isFunctionDeclaration(statement) && statement.name) {
      add(statement.name);
    }
  }
  for (const declaration of declarationsInScope(file, found)) {
    const init = unwrap(declaration.initializer);
    if (!init) {
      continue;
    }
    if (
      ts.isIdentifier(declaration.name) &&
      (ts.isArrowFunction(init) || ts.isFunctionExpression(init))
    ) {
      add(declaration.name);
    }
    // const [text, setText] = useState(...): the setter is a handler too.
    if (
      ts.isArrayBindingPattern(declaration.name) &&
      ts.isCallExpression(init) &&
      /^(React\.)?use(State|Reducer)$/.test(init.expression.getText())
    ) {
      const setter = declaration.name.elements[1];
      if (setter && ts.isBindingElement(setter) && ts.isIdentifier(setter.name)) {
        add(setter.name);
      }
    }
  }
  return handlers
    .filter((handler) => !/^[A-Z]/.test(handler.name))
    .sort((a, b) => a.start - b.start);
}
