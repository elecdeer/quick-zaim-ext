import { defineConfig } from "vite-plus/pack";

export default defineConfig({
  entry: ["./src/index.ts", "./src/client.ts"],
  // 型宣言専用パッケージなので runtime 解決不要
  deps: { neverBundle: ["@cloudflare/workers-types"] },
  dts: {
    sourcemap: true,
  },
  sourcemap: true,
});
