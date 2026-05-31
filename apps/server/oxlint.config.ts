import rootConfig from "../../oxlint.config.ts";
import { defineConfig } from "oxlint";

export default defineConfig({
  extends: [rootConfig],
  plugins: ["node", "promise"],
  overrides: [
    {
      files: ["**/*.test.ts"],
      plugins: ["vitest"],
    },
  ],
});
