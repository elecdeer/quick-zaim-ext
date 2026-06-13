import rootConfig from "../../oxlint.config.ts";
import { defineConfig } from "oxlint";

export default defineConfig({
  extends: [rootConfig],
  plugins: ["react", "react-perf", "jsx-a11y", "vitest"],
  overrides: [
    {
      // test.extend で作ったカスタム test を oxlint が認識しないため誤検知を抑制する
      files: ["**/*.test.browser.{ts,tsx}"],
      rules: {
        "vitest/no-standalone-expect": "off",
      },
    },
    {
      // shadcn/ui が自動生成するコンポーネントは関数宣言スタイルなのでルールを緩める
      files: ["src/components/ui/**/*.{ts,tsx}"],
      rules: {
        "func-style": "off",
        "jsx-a11y/label-has-associated-control": "off",
      },
    },
  ],
});
