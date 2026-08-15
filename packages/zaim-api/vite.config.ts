import tsdownConfig from "./tsdown.config.js";

import { defineConfig } from "vite-plus";

export default defineConfig({
  fmt: {
    ignorePatterns: ["src/generated/**", "tsp-output/**"],
  },
  pack: tsdownConfig,
  run: {
    tasks: {
      generate: {
        command: "pnpm run generate:openapi3 && pnpm run generate:ts-client",
        output: ["src/generated/**", "tsp-output/**"],
      },
      build: {
        // グローバル vp だと dts 生成時に typescript の解決に失敗するため、ローカルの vp を明示的に使う
        command: "pnpm exec vp pack",
        dependsOn: ["generate"],
      },
      check: {
        command: "vp check",
        dependsOn: ["generate"],
      },
    },
  },
});
