import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  // The example is served under /example/ on jsctrls.com; locally it stays at /.
  base: process.env.HELLO_BASE ?? "/",
  plugins: [react()],
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:8081",
        changeOrigin: true,
      },
    },
  },
});
