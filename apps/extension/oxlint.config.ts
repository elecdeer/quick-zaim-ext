import rootConfig from "../../oxlint.config.ts";
import { defineConfig } from "oxlint";

export default defineConfig({
  extends: [rootConfig],
  plugins: ["react", "react-perf", "jsx-a11y"],
  overrides: [
    {
      files: ["**/*.test.{ts,tsx}", "**/*.test.browser.{ts,tsx}"],
      plugins: ["vitest"],
    },
  ],
});
