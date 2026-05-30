import { defineConfig } from "vite-plus";
import { playwright } from "vite-plus/test/browser-playwright";

export default defineConfig({
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
    setupFiles: "./vitest.setup.ts",
  },
});
