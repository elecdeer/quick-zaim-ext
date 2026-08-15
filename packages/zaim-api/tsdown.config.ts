import { defineConfig } from "vite-plus/pack";

export default defineConfig({
  entry: ["./src/generated/client/index.ts"],
  dts: {
    sourcemap: true,
  },
  sourcemap: true,
});
