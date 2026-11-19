import type { Plugin } from "vite";
import { OVERLAY_SCRIPT } from "./overlay.ts";
import { SOURCE_ATTRIBUTE, tagSource } from "./tagSource.ts";

const OVERLAY_PATH = "/@jsctrls/design-overlay.js";

/**
 * Dev-only plugin for the jsctrls designer. It tags every JSX element with its
 * source location and serves a small overlay script that the designer canvas
 * uses to select elements. It does nothing in a production build.
 */
export function jsctrlsDesign(): Plugin {
  return {
    name: "jsctrls-design",
    apply: "serve",
    enforce: "pre",
    transform(code, id) {
      const file = id.split("?")[0] ?? id;
      if (!file.endsWith(".tsx") || file.includes("/node_modules/")) {
        return null;
      }
      return { code: tagSource(code, file), map: null };
    },
    configureServer(server) {
      server.middlewares.use(OVERLAY_PATH, (_request, response) => {
        response.setHeader("Content-Type", "text/javascript");
        response.end(OVERLAY_SCRIPT);
      });
    },
    transformIndexHtml() {
      return [{ tag: "script", attrs: { type: "module", src: OVERLAY_PATH }, injectTo: "body" }];
    },
  };
}

export { SOURCE_ATTRIBUTE, tagSource };
