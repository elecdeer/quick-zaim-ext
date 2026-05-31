import { defineConfig } from "oxlint";

/** typeAware/typeCheck を含まない共有ベース設定 */
export const baseConfig = defineConfig({
  plugins: ["typescript"],
  rules: {
    "typescript/no-non-null-assertion": "error",
    "func-style": ["error", "expression"],
  },
  ignorePatterns: ["**/mockServiceWorker.js"],
});
