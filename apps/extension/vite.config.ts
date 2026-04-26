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
        command: "wxt dev",
        dependsOn: ["@repo/zaim-api#generate"],
      },
      build: {
        command: "wxt build",
        dependsOn: ["@repo/zaim-api#generate"],
      },
    },
  },
});
