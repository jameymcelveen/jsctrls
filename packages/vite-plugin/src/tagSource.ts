import ts from "typescript";

/** The attribute the designer reads: "<absolute file path>#<start offset>". */
export const SOURCE_ATTRIBUTE = "data-jc-src";

/**
 * Add data-jc-src to every JSX element in a .tsx file. The offset is the
 * element's start in the ORIGINAL text, the same offset the designer's parser
 * reports, so the canvas and the structure list name the same node.
 * Fragments are skipped because they cannot take attributes.
 */
export function tagSource(code: string, file: string): string {
  const source = ts.createSourceFile(file, code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const inserts: { at: number; text: string }[] = [];

  const visit = (node: ts.Node): void => {
    const opening = ts.isJsxElement(node)
      ? node.openingElement
      : ts.isJsxSelfClosingElement(node)
        ? node
        : undefined;
    if (opening) {
      const tag = opening.tagName.getText(source);
      const alreadyTagged = opening.attributes.properties.some(
        (attribute) =>
          ts.isJsxAttribute(attribute) && attribute.name.getText(source) === SOURCE_ATTRIBUTE,
      );
      if (!alreadyTagged && tag !== "Fragment" && !tag.endsWith(".Fragment")) {
        const value = `${file}#${node.getStart(source)}`;
        inserts.push({
          at: opening.tagName.getEnd(),
          text: ` ${SOURCE_ATTRIBUTE}=${JSON.stringify(value)}`,
        });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);

  let out = code;
  for (const insert of inserts.sort((a, b) => b.at - a.at)) {
    out = out.slice(0, insert.at) + insert.text + out.slice(insert.at);
  }
  return out;
}
