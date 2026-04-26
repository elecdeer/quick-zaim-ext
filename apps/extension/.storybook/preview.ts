import { definePreview } from "@storybook/react-vite";
import { initialize, mswLoader } from "msw-storybook-addon";

import "../src/assets/global.css";

initialize({
  onUnhandledRequest: "warn",
});

export default definePreview({
  addons: [],
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    layout: "padded",
  },
  loaders: [mswLoader],
});
