import { build } from "esbuild";

// Extension host: Node, CommonJS, with the vscode module provided at runtime.
await build({
  entryPoints: ["src/extension.ts"],
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node20",
  external: ["vscode"],
  outfile: "dist/extension.cjs",
  sourcemap: true,
  logLevel: "info",
});

// Webview: browser bundle with its CSS beside it.
await build({
  entryPoints: { webview: "webview/main.tsx" },
  bundle: true,
  platform: "browser",
  format: "iife",
  target: "es2022",
  jsx: "automatic",
  define: { "process.env.NODE_ENV": '"production"' },
  outdir: "dist",
  sourcemap: true,
  logLevel: "info",
});
