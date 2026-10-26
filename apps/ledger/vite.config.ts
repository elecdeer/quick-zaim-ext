import { voidReact } from "@void/react/plugin";
import { voidPlugin } from "void";
import { defineConfig } from "vite-plus";

export default defineConfig({
  plugins: [voidPlugin(), voidReact()],
  // Vite の開発サーバーは既定でプリフライト（OPTIONS）を自前で返してしまい、
  // middleware/01.cors.ts まで届かないため無効にする
  server: { cors: false },
});
