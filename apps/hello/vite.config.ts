import { jsctrlsDesign } from "@jsctrls/vite-plugin";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  // The example is served under /example/ on jsctrls.com; locally it stays at /.
  base: process.env.HELLO_BASE ?? "/",
  // jsctrlsDesign only acts in `vite dev`: it lets the jsctrls designer canvas select elements.
  plugins: [jsctrlsDesign(), react()],
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:8081",
        changeOrigin: true,
      },
    },
  },
});
