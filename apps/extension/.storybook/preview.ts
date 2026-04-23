import type { Preview } from "@storybook/react";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error -- CSS import is handled by Vite; TS doesn't know the module
import "../src/assets/global.css";

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    layout: "padded",
  },
};

export default preview;
