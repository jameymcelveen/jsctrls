import * as vscode from "vscode";
import { createHandler, insertControl, setContent, setProp, type Change } from "./edits";
import { parseTsx } from "./model";
import type { HostMessage, WebviewMessage } from "./protocol";

const VIEW_TYPE = "jsctrls.designer";

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.window.registerCustomEditorProvider(
      VIEW_TYPE,
      new DesignerProvider(context.extensionUri),
      {
        supportsMultipleEditorsPerDocument: true,
      },
    ),
    vscode.commands.registerCommand("jsctrls.openDesigner", async (uri?: vscode.Uri) => {
      const target = uri ?? vscode.window.activeTextEditor?.document.uri;
      if (!target || !target.path.endsWith(".tsx")) {
        void vscode.window.showInformationMessage("Open a .tsx file first.");
        return;
      }
      await vscode.commands.executeCommand("vscode.openWith", target, VIEW_TYPE);
    }),
  );
}

export function deactivate(): void {
  // Nothing to clean up; subscriptions are disposed by VS Code.
}

class DesignerProvider implements vscode.CustomTextEditorProvider {
  constructor(private readonly extensionUri: vscode.Uri) {}

  resolveCustomTextEditor(document: vscode.TextDocument, panel: vscode.WebviewPanel): void {
    const dist = vscode.Uri.joinPath(this.extensionUri, "dist");
    panel.webview.options = { enableScripts: true, localResourceRoots: [dist] };
    panel.webview.html = this.html(panel.webview, dist);

    const post = (message: HostMessage) => {
      void panel.webview.postMessage(message);
    };
    // An element to select once the edit that creates it lands.
    let pendingSelect: number | undefined;
    const sendModel = () => {
      try {
        post({
          type: "model",
          version: document.version,
          fileName: document.fileName,
          canvasUrl: canvasUrl(),
          ...parseTsx(document.getText(), document.fileName),
          ...(pendingSelect === undefined ? {} : { select: pendingSelect }),
        });
        pendingSelect = undefined;
      } catch (error) {
        post({ type: "error", message: `Could not read this file: ${String(error)}` });
      }
    };

    const changes = vscode.workspace.onDidChangeTextDocument((event) => {
      if (event.document.uri.toString() === document.uri.toString()) {
        sendModel();
      }
    });
    panel.onDidDispose(() => {
      changes.dispose();
    });

    const reveal = async (offset: number) => {
      const position = document.positionAt(offset);
      await vscode.window.showTextDocument(document, {
        viewColumn: vscode.ViewColumn.Beside,
        selection: new vscode.Range(position, position),
      });
    };

    panel.webview.onDidReceiveMessage(async (message: WebviewMessage) => {
      if (message.type === "ready") {
        sendModel();
        return;
      }
      if (message.type === "reveal") {
        await reveal(message.offset);
        return;
      }
      if (message.version !== document.version) {
        sendModel();
        return;
      }
      const text = document.getText();
      let change: Change | string;
      switch (message.type) {
        case "setProp":
          change = setProp(text, message.node, message.name, message.value);
          break;
        case "setContent":
          change = setContent(text, message.node, message.text);
          break;
        case "createHandler":
          change = createHandler(text, message.node, message.event);
          break;
        case "insert":
          change = insertControl(text, message.anchor, message.control);
          break;
      }
      if (typeof change === "string") {
        post({ type: "error", message: change });
        sendModel();
        return;
      }
      if (change.edits.length === 0) {
        return;
      }
      // One WorkspaceEdit, so one undo puts the whole change back.
      const edit = new vscode.WorkspaceEdit();
      for (const { start, end, newText } of change.edits) {
        edit.replace(
          document.uri,
          new vscode.Range(document.positionAt(start), document.positionAt(end)),
          newText,
        );
      }
      pendingSelect = change.select;
      const applied = await vscode.workspace.applyEdit(edit);
      if (!applied) {
        pendingSelect = undefined;
        post({ type: "error", message: "VS Code did not apply the edit." });
        sendModel();
        return;
      }
      if (change.reveal !== undefined) {
        await reveal(change.reveal);
      }
    });
  }

  private html(webview: vscode.Webview, dist: vscode.Uri): string {
    const nonce = Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) =>
      b.toString(16).padStart(2, "0"),
    ).join("");
    const script = webview.asWebviewUri(vscode.Uri.joinPath(dist, "webview.js"));
    const style = webview.asWebviewUri(vscode.Uri.joinPath(dist, "webview.css"));
    let frameOrigin = "http://localhost:*";
    try {
      frameOrigin = new URL(canvasUrl()).origin;
    } catch {
      // Keep the localhost default when the setting is not a valid URL.
    }
    const csp = [
      "default-src 'none'",
      `frame-src ${frameOrigin} http://localhost:* http://127.0.0.1:*`,
      `style-src ${webview.cspSource}`,
      `script-src 'nonce-${nonce}'`,
      `font-src ${webview.cspSource}`,
    ].join("; ");
    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="${csp}">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="stylesheet" href="${style.toString()}">
<title>jsctrls Designer</title>
</head>
<body>
<div id="root"></div>
<script nonce="${nonce}" src="${script.toString()}"></script>
</body>
</html>`;
  }
}

function canvasUrl(): string {
  return vscode.workspace
    .getConfiguration("jsctrls.designer")
    .get<string>("devServerUrl", "http://localhost:5173");
}
