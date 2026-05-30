import path from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig, lazyPlugins } from "vite-plus";
import { playwright } from "vite-plus/test/browser-playwright";

const dirname =
  typeof __dirname !== "undefined" ? __dirname : path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: lazyPlugins(async () => {
    const { storybookTest } = await import("@storybook/addon-vitest/vitest-plugin");
    return [storybookTest({ configDir: path.join(dirname, ".storybook") })];
  }),
  lint: {
    options: {
      typeAware: true,
      typeCheck: true,
    },
  },
  run: {
    tasks: {
      dev: {
        command: "wxt",
        dependsOn: ["@repo/zaim-api#generate"],
      },
      build: {
        command: "wxt build",
        dependsOn: ["@repo/zaim-api#generate"],
      },
    },
  },
  test: {
    name: "storybook",
    browser: {
      enabled: true,
      headless: true,
      provider: playwright({}),
      instances: [{ browser: "chromium" }],
    },
  },
});
