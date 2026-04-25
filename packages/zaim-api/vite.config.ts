import { defineConfig } from "vite-plus";

export default defineConfig({
  lint: {
    options: {
      typeAware: true,
      typeCheck: true,
    },
  },
  fmt: {
    ignorePatterns: ["src/generated/**", "tsp-output/**"],
  },
  pack: {
    dts: {
      sourcemap: true,
    },
    sourcemap: true,
  },
  run: {
    tasks: {
      generate: {
        command: "pnpm run generate:openapi3 && pnpm run generate:ts-client",
      },
      build: {
        command: "vp pack ./src/generated/client/index.ts",
        dependsOn: ["generate"],
      },
    },
  },
});
