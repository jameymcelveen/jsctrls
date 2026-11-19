import * as vscode from "vscode";
import { parseTsx, validateEdit } from "./model";
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
    const sendModel = () => {
      try {
        post({
          type: "model",
          version: document.version,
          ...parseTsx(document.getText(), document.fileName),
        });
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

    panel.webview.onDidReceiveMessage(async (message: WebviewMessage) => {
      if (message.type === "ready") {
        sendModel();
        return;
      }
      if (message.version !== document.version) {
        sendModel();
        return;
      }
      const edit = { start: message.start, end: message.end, newText: message.newText };
      const problem = validateEdit(document.getText(), edit);
      if (problem) {
        post({ type: "error", message: problem });
        sendModel();
        return;
      }
      const change = new vscode.WorkspaceEdit();
      change.replace(
        document.uri,
        new vscode.Range(document.positionAt(edit.start), document.positionAt(edit.end)),
        edit.newText,
      );
      const applied = await vscode.workspace.applyEdit(change);
      if (!applied) {
        post({ type: "error", message: "VS Code did not apply the edit." });
        sendModel();
      }
    });
  }

  private html(webview: vscode.Webview, dist: vscode.Uri): string {
    const nonce = Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) =>
      b.toString(16).padStart(2, "0"),
    ).join("");
    const script = webview.asWebviewUri(vscode.Uri.joinPath(dist, "webview.js"));
    const style = webview.asWebviewUri(vscode.Uri.joinPath(dist, "webview.css"));
    const csp = [
      "default-src 'none'",
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
