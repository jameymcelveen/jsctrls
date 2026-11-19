import type { DesignModel, MovePosition, TextEdit } from "./model";

/** Host to webview. */
export type HostMessage =
  | ({
      readonly type: "model";
      readonly version: number;
      /** Absolute path of the document, to match canvas selections to this file. */
      readonly fileName: string;
      /** Dev server page the canvas shows. */
      readonly canvasUrl: string;
    } & DesignModel)
  | { readonly type: "error"; readonly message: string };

/** Webview to host. */
export type WebviewMessage =
  | { readonly type: "ready" }
  | ({ readonly type: "edit"; readonly version: number } & TextEdit)
  | {
      readonly type: "move";
      readonly version: number;
      /** Start offsets of the dragged node and the sibling it was dropped on. */
      readonly from: number;
      readonly to: number;
      readonly position: MovePosition;
    };
