import type { ControlName, PropValue } from "./edits";
import type { DesignModel } from "./model";

/** Host to webview. */
export type HostMessage =
  | ({
      readonly type: "model";
      readonly version: number;
      /** Absolute path of the document, to match canvas selections to this file. */
      readonly fileName: string;
      /** Dev server page the canvas shows. */
      readonly canvasUrl: string;
      /** Start offset of an element to select, after an insert. */
      readonly select?: number;
    } & DesignModel)
  | { readonly type: "error"; readonly message: string };

/**
 * Webview to host. Elements are named by their start offset in the version
 * the webview last saw; the host drops a message made against an older one.
 */
export type WebviewMessage =
  | { readonly type: "ready" }
  | {
      readonly type: "setProp";
      readonly version: number;
      readonly node: number;
      readonly name: string;
      /** null removes the prop. */
      readonly value: PropValue | null;
    }
  | {
      readonly type: "setContent";
      readonly version: number;
      readonly node: number;
      readonly text: string;
    }
  | {
      readonly type: "createHandler";
      readonly version: number;
      readonly node: number;
      readonly event: string;
    }
  | {
      readonly type: "insert";
      readonly version: number;
      /** The selected element, or null for the component's root. */
      readonly anchor: number | null;
      readonly control: ControlName;
    }
  /** Show this offset of the file in the code editor. */
  | { readonly type: "reveal"; readonly offset: number };
