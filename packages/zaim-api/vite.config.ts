import { defineConfig } from "vite-plus";

export default defineConfig({
  lint: {
    options: {
      typeAware: true,
      typeCheck: true,
    },
  },
  fmt: {},
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
        input: ["typespec/**", "tspconfig.yaml", "openapi-ts.config.ts"],
      },
    },
  },
});
