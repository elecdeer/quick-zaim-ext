import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import { defineMain } from "@storybook/react-vite/node";

export default defineMain({
  stories: ["../src/**/*.stories.{ts,tsx}"],
  addons: ["@storybook/addon-vitest"],
  framework: {
    name: "@storybook/react-vite",
    options: {},
  },
  features: {
    experimentalTestSyntax: true,
  },
  viteFinal: (config) => ({
    ...config,
    plugins: [...(config.plugins ?? []), tailwindcss()],
    resolve: {
      ...(config.resolve ?? {}),
      alias: {
        ...(config.resolve?.alias ?? {}),
        "@": fileURLToPath(new URL("../src", import.meta.url)),
      },
    },
  }),
  staticDirs: ["../storybook-public"],
});
