import { defineConfig } from "vite-plus";

export default defineConfig({
  staged: {
    "*": "vp check --fix",
  },
  fmt: {
    exclude: ["**/.wrangler/**", "**/.output/**", "**/.wxt/**"],
  },
  lint: {
    ignorePatterns: ["**/.output/**", "**/.wxt/**"],
    options: { typeAware: true, typeCheck: true },
  },
  run: {
    cache: true,
  },
});
