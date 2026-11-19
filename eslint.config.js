import eslint from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";
import { defineConfig } from "eslint/config";

export default defineConfig(
  {
    ignores: ["**/dist/**", "**/coverage/**", "server/**"],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    extends: [reactHooks.configs.flat.recommended],
  },
  {
    files: ["packages/core/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            { name: "react", message: "@jsctrls/core must not depend on a UI framework." },
            { name: "react-dom", message: "@jsctrls/core must not depend on a UI framework." },
          ],
          patterns: [
            {
              group: ["react/*", "react-dom/*"],
              message: "@jsctrls/core must not depend on a UI framework.",
            },
          ],
        },
      ],
    },
  },
);
