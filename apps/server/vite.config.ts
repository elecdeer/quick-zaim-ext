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
      "deploy:preview": {
        // --name 省略時は現在の git ブランチ名が Preview 名になる（Workers Builds と同じ Preview を更新する）
        command: "wrangler preview",
        dependsOn: ["@repo/zaim-api#generate"],
        cache: false,
      },
      "build:types": {
        // グローバル vp だと dts 生成時に typescript の解決に失敗するため、ローカルの vp を明示的に使う
        command: "pnpm exec vp pack",
        dependsOn: ["@repo/zaim-api#generate"],
      },
      test: {
        command: "vp test run",
        dependsOn: ["@repo/zaim-api#generate"],
      },
    },
  },
});
