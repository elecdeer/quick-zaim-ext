import { definePreview } from "@storybook/react-vite";
// @ts-expect-error -- CSS import is handled by Vite; TS doesn't know the module
import "../src/assets/global.css";

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
});
