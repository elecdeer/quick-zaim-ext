import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      "apps/extension/vitest.config.ts",
      "apps/extension/vitest.config.browser.ts",
      "apps/server",
      "packages/zaim-api",
    ],
  },
});
