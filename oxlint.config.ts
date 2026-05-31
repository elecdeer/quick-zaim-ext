import { defineConfig } from "oxlint";

export default defineConfig({
  options: {
    typeAware: true,
    typeCheck: true,
  },
  plugins: ["typescript"],
  rules: {
    "typescript/no-non-null-assertion": "error",
    "func-style": ["error", "expression"],
  },
  ignorePatterns: ["**/mockServiceWorker.js"],
});
