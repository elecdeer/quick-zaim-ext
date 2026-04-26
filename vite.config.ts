import { defineConfig } from "vite-plus";

export default defineConfig({
  staged: {
    "*": "vp check --fix",
  },
  fmt: {
    ignorePatterns: ["**/.wrangler/**", "**/.output/**", "**/.wxt/**", "**/mockServiceWorker.js"],
  },
  lint: {
    ignorePatterns: ["**/.output/**", "**/.wxt/**"],
    options: {
      typeAware: true,
      typeCheck: true,
    },
  },
  run: {
    cache: true,
  },
});
