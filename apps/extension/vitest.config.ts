import react from "@vitejs/plugin-react";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      {
        plugins: [react()],
        optimizeDeps: {
          include: ["react", "react-dom/client", "react/jsx-dev-runtime", "vitest-browser-react"],
        },
        test: {
          name: "extension-browser-inline",
          include: ["src/entrypoints/sidepanel/screens/MainScreen.test.browser.tsx"],
          browser: {
            enabled: true,
            headless: true,
            provider: playwright(),
            instances: [{ browser: "chromium" }],
          },
        },
      },
      {
        test: {
          name: "extension-unit",
          include: ["src/**/*.test.{ts,tsx}"],
          exclude: ["src/**/*.test.browser.{ts,tsx}"],
          environment: "node",
        },
      },
    ],
  },
});
