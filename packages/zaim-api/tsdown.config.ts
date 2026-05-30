import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["./src/generated/client/index.ts"],
  dts: {
    sourcemap: true,
  },
  sourcemap: true,
});
