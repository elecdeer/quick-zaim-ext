import { defineConfig } from "vite-plus";

export default defineConfig({
  run: {
    tasks: {
      dev: {
        command: "wxt",
        dependsOn: ["@repo/zaim-api#generate"],
        cache: false,
      },
      build: {
        command: "wxt build",
        dependsOn: ["@repo/zaim-api#generate", "server#build:types"],
      },
      test: {
        // src 直下のユニットテストは現状すべて test.browser.tsx に集約されており空になり得るため許可する
        command: "vitest run --passWithNoTests",
        dependsOn: ["@repo/zaim-api#generate"],
      },
    },
  },
});
