import { defineConfig } from "oxlint";

export default defineConfig({
  plugins: ["typescript"],
  rules: {
    "typescript/no-non-null-assertion": "error",
    "func-style": ["error", "expression"],
  },
  ignorePatterns: [
    "**/.wrangler/**",
    "**/.output/**",
    "**/.wxt/**",
    "**/mockServiceWorker.js",
    "**/src/generated/**",
    "**/tsp-output/**",
  ],
});
