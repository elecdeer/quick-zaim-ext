import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { playwright } from "@vitest/browser-playwright";
import { defineProject } from "vitest/config";

export default defineProject({
  plugins: [react(), tailwindcss()],
  // MSWサービスワーカー（mockServiceWorker.js）を /mockServiceWorker.js として配信する
  publicDir: "./storybook-public",
  optimizeDeps: {
    include: ["react", "react-dom/client", "react/jsx-dev-runtime", "vitest-browser-react"],
  },
  test: {
    name: "extension/visual",
    include: ["src/**/*.visual.test.browser.{ts,tsx}"],
    testTimeout: 30000,
    browser: {
      enabled: true,
      headless: true,
      provider: playwright({
        launchOptions: {
          args: [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            // Dockerでのメモリ不足によるクラッシュを防ぐ
            "--disable-dev-shm-usage",
          ],
        },
      }),
      instances: [{ browser: "chromium" }],
      expect: {
        toMatchScreenshot: {
          comparatorName: "pixelmatch",
          comparatorOptions: {
            threshold: 0.3,
            allowedMismatchedPixelRatio: 0.05,
          },
          // カーソルとアニメーションを無効化してスクリーンショットを安定させる
          screenshotOptions: {
            animations: "disabled",
            caret: "hide",
          },
        },
      },
    },
    setupFiles: ["./vitest.setup.browser.ts"],
  },
});
