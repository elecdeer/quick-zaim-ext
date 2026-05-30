import { defineConfig } from "oxfmt";

export default defineConfig({
  ignorePatterns: [
    "**/.wrangler/**",
    "**/.output/**",
    "**/.wxt/**",
    "**/mockServiceWorker.js",
    "packages/zaim-api/src/generated/**",
    "packages/zaim-api/tsp-output/**",
    "**/node_modules/**",
  ],
});
