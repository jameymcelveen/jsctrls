# jsctrls Designer (spike)

A VS Code extension that opens a React `.tsx` file as a designer. This is the first slice of spec 014. It proves the hard part: reading real TSX and editing it without rewriting the file.

The designer's own UI is built from jsctrls: the structure panel is a jsctrls `ListBox` bound to a DataSet over the parsed nodes, and the inspector fields are jsctrls `TextInput`s.

## What it does

- Opens any `.tsx` file in a "jsctrls Designer" editor. It never becomes the default editor.
- Lists the JSX of the file's component in document order: the default export, or the first component.
- Shows the selected element's props in an inspector:
  - Text props (`display="name"`) are editable. Enter or leaving the field commits; Escape cancels.
  - Expressions (`dataSet={names}`), flags (`disabled`) and spreads are read-only and marked `code` or `flag`.
- Shows code inside JSX (`{rows.map(...)}`, ternaries) as `[locked]` blocks to edit in the text editor.
- Shows the source line of the selected node.
- Applies an edit as one replacement of the text inside the quotes and nothing else, so undo, dirty state and git diffs behave as if you typed it. An edit made against an older version of the file is dropped.

## Run it

1. Open this repo in VS Code or Cursor.
2. Run and Debug, then "Run jsctrls Designer". It builds the extension and opens a second window on this repo.
3. In that window open `apps/hello/src/App.tsx`.
4. Click the designer button in the editor title bar, or run "jsctrls: Open Designer", or right-click the tab and choose "Reopen Editor With", then "jsctrls Designer".
5. Select `ListBox`, change `display` from `name` to `id`, press Enter. Switch back to the text editor: one line changed, and Undo puts it back.

## Develop

```sh
pnpm --filter jsctrls-designer build   # dist/extension.cjs and dist/webview.js
pnpm --filter jsctrls-designer test    # parser and edit tests, no VS Code needed
```

`src/model.ts` (parser and edit checks) has no `vscode` import, so it is tested with Vitest. `src/extension.ts` is the host; `webview/` is the React UI.

## Not in this slice

The canvas, drag and drop, the palette, the tray for non-visual components, meta-driven inspectors, the `*` fallback for unknown controls, a Tree control, and publishing the extension.

## Known limits

- The host bundle is about 10 MB because it carries the TypeScript compiler.
- Only string props are editable, and a value cannot contain the attribute's quote character or a line break.
