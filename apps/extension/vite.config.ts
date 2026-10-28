import { defineConfig } from "vite-plus";

export default defineConfig({
  test: {
    // Vitest v4 compatibility: preserve mock call history.
    // Remove after tests no longer rely on calls from setup or earlier tests.
    // https://viteplus.dev/guide/vitest-v5#remove-unneeded-compatibility-settings
    // https://vitest.dev/guide/migration/#clearmocks-is-enabled-by-default
    clearMocks: false,
  },
  run: {
    tasks: {
      dev: {
        command: "wxt",
        cache: false,
      },
      build: {
        command: "wxt build",
        dependsOn: ["ledger#build:types"],
      },
      test: {
        // src 直下のユニットテストは現状すべて test.browser.tsx に集約されており空になり得るため許可する
        command: "vp test run --passWithNoTests",
      },
    },
  },
});
