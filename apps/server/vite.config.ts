import { defineConfig } from "vite-plus";

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
        command: "wrangler dev",
        dependsOn: ["@repo/zaim-api#generate"],
      },
      build: {
        command: "wrangler deploy --dry-run --outdir dist",
        dependsOn: ["@repo/zaim-api#generate"],
      },
    },
  },
});
