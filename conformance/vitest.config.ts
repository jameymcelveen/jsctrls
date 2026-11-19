import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    // One server, shared state: run the tests in file order.
    sequence: { concurrent: false },
    fileParallelism: false,
  },
});
