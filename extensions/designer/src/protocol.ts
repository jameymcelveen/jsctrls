import type { DesignModel, TextEdit } from "./model";

/** Host to webview. */
export type HostMessage =
  | ({ readonly type: "model"; readonly version: number } & DesignModel)
  | { readonly type: "error"; readonly message: string };

/** Webview to host. */
export type WebviewMessage =
  { readonly type: "ready" } | ({ readonly type: "edit"; readonly version: number } & TextEdit);
