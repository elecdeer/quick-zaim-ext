import { defineConfig } from "vite-plus";

export default defineConfig({
  lint: {
    options: {
      typeAware: true,
      typeCheck: true,
    },
  },
  fmt: {},
  pack: {
    dts: {
      sourcemap: true,
    },
    sourcemap: true,
  },
});
