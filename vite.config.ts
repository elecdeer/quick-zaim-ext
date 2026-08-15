import { defineConfig } from "vite-plus";

export default defineConfig({
  staged: {
    "*": "vp check --fix",
  },
  fmt: {
    ignorePatterns: ["**/.wrangler/**", "**/.output/**", "**/.wxt/**", "**/mockServiceWorker.js"],
  },
  lint: {
    plugins: ["typescript"],
    jsPlugins: [{ name: "vite-plus", specifier: "vite-plus/oxlint-plugin" }],
    ignorePatterns: ["**/.output/**", "**/.wxt/**", "**/mockServiceWorker.js"],
    options: { typeAware: true, typeCheck: true },
    rules: {
      "vite-plus/prefer-vite-plus-imports": "error",
      "typescript/no-non-null-assertion": "error",
      "func-style": ["error", "expression"],
    },
    overrides: [
      {
        files: ["apps/extension/**"],
        plugins: ["react", "react-perf", "jsx-a11y", "vitest"],
      },
      {
        // test.extend で作ったカスタム test を oxlint が認識しないため誤検知を抑制する
        files: ["apps/extension/**/*.test.browser.{ts,tsx}"],
        plugins: ["react", "react-perf", "jsx-a11y", "vitest"],
        rules: {
          "vitest/no-standalone-expect": "off",
        },
      },
      {
        // shadcn/ui が自動生成するコンポーネントは関数宣言スタイルなのでルールを緩める
        files: ["apps/extension/src/components/ui/**/*.{ts,tsx}"],
        plugins: ["react", "react-perf", "jsx-a11y", "vitest"],
        rules: {
          "func-style": "off",
          "jsx-a11y/label-has-associated-control": "off",
        },
      },
      {
        files: ["apps/server/**"],
        plugins: ["node", "promise", "vitest"],
      },
      {
        files: ["packages/zaim-api/**"],
        plugins: ["import", "promise", "vitest"],
      },
    ],
  },
  run: {
    cache: true,
  },
});
