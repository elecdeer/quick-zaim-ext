import tsdownConfig from "./tsdown.config.js";

import { defineConfig } from "vite-plus";

export default defineConfig({
  pack: tsdownConfig,
  run: {
    tasks: {
      dev: {
        command: "wrangler dev",
        dependsOn: ["@repo/zaim-api#generate"],
        cache: false,
      },
      build: {
        command: "wrangler deploy --dry-run --outdir dist",
        dependsOn: ["@repo/zaim-api#generate"],
      },
      "build:types": {
        // グローバル vp だと dts 生成時に typescript の解決に失敗するため、ローカルの vp を明示的に使う
        command: "pnpm exec vp pack",
        dependsOn: ["@repo/zaim-api#generate"],
      },
      test: {
        command: "vitest run",
        dependsOn: ["@repo/zaim-api#generate"],
      },
    },
  },
});
