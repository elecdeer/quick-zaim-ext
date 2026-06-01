import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { playwright } from "@vitest/browser-playwright";
import { defineProject } from "vitest/config";

export default defineProject({
  plugins: [react(), tailwindcss()],
  optimizeDeps: {
    include: ["react", "react-dom/client", "react/jsx-dev-runtime", "vitest-browser-react"],
  },
  test: {
    name: "extension/browser",
    include: ["src/**/*.test.browser.{ts,tsx}"],
    exclude: ["src/**/*.visual.test.browser.{ts,tsx}"],
    browser: {
      enabled: true,
      headless: true,
      provider: playwright(),
      instances: [{ browser: "chromium" }],
    },
    setupFiles: ["./vitest.setup.browser.ts"],
  },
});
