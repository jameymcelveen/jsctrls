import ts from "typescript";

/** How a prop's value is written in the source. */
export type PropKind = "string" | "expression" | "flag";

export interface DesignProp {
  readonly name: string;
  readonly kind: PropKind;
  /** The value as written: the text inside the quotes, the expression source, or "true". */
  readonly value: string;
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
  /** Full source for locked blocks. */
  readonly source?: string;
}

export interface DesignModel {
  readonly component: string | null;
  readonly nodes: readonly DesignNode[];
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
    return { component: null, nodes: [] };
  }
  const nodes: DesignNode[] = [];
  walk(file, found.jsx, "0", 0, nodes);
  return { component: found.name, nodes };
}

/** Replace one span of text. Everything outside [start, end) is left byte for byte. */
export function applyTextEdit(text: string, edit: TextEdit): string {
  return text.slice(0, edit.start) + edit.newText + text.slice(edit.end);
}

/**
 * Check an edit against the current text before applying it. Returns an error
 * message, or null when the edit replaces exactly one string prop value with
 * text that keeps the attribute valid.
 */
export function validateEdit(text: string, edit: TextEdit): string | null {
  const prop = parseTsx(text)
    .nodes.flatMap((node) => node.props)
    .find((candidate) => candidate.start === edit.start && candidate.end === edit.end);
  if (!prop || prop.kind !== "string") {
    return "The edit does not match a string prop in the current file.";
  }
  const quote = text.charAt(edit.start - 1);
  if (edit.newText.includes(quote) || /[\r\n]/.test(edit.newText)) {
    return `The value cannot contain ${quote} or a line break.`;
  }
  return null;
}

type Jsx = ts.JsxElement | ts.JsxSelfClosingElement | ts.JsxFragment;

function isJsx(node: ts.Node): node is Jsx {
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

interface Candidate {
  readonly name: string;
  readonly jsx: Jsx;
  readonly isDefault: boolean;
}

function findComponent(file: ts.SourceFile): Candidate | undefined {
  const candidates: Candidate[] = [];
  let defaultName: string | undefined;

  for (const statement of file.statements) {
    const modifiers = ts.canHaveModifiers(statement) ? ts.getModifiers(statement) : undefined;
    const isDefault = Boolean(modifiers?.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword));
    if (ts.isFunctionDeclaration(statement)) {
      const jsx = returnedJsx(statement.body);
      if (jsx) {
        candidates.push({ name: statement.name?.text ?? "default", jsx, isDefault });
      }
    } else if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        const init = unwrap(declaration.initializer);
        if (init && (ts.isArrowFunction(init) || ts.isFunctionExpression(init))) {
          const jsx = returnedJsx(init.body);
          if (jsx && ts.isIdentifier(declaration.name)) {
            candidates.push({ name: declaration.name.text, jsx, isDefault: false });
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
          candidates.push({ name: "default", jsx, isDefault: true });
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

function tagName(node: Jsx): string {
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
      return { name: "...", kind: "expression", value: attribute.expression.getText() };
    }
    const name = attribute.name.getText();
    const init = attribute.initializer;
    if (!init) {
      return { name, kind: "flag", value: "true" };
    }
    if (ts.isStringLiteral(init)) {
      const start = init.getStart() + 1;
      const end = init.getEnd() - 1;
      return {
        name,
        kind: "string",
        value: init.getSourceFile().text.slice(start, end),
        start,
        end,
      };
    }
    const value = ts.isJsxExpression(init) ? (init.expression?.getText() ?? "") : init.getText();
    return { name, kind: "expression", value };
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
