import { definePreview } from "@storybook/react-vite";
import { initialize, mswLoader } from "msw-storybook-addon";
import { fakeBrowser } from "wxt/testing/fake-browser";

import "../src/assets/global.css";

initialize({
  onUnhandledRequest: "warn",
});

// wxt/browser はモジュールインポート時に globalThis.browser ?? globalThis.chrome を評価するため、
// ストーリーのモジュールがロードされる前に設定しておく必要がある。
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).chrome = fakeBrowser;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).browser = fakeBrowser;

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
