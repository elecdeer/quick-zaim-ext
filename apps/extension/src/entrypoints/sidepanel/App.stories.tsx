import preview from "#storybook/preview";
import { setupBrowserMock } from "../../test-utils/browser-mock.ts";
import {
  masterHandlers,
  meHandler,
  MOCK_SERVER_URL,
  unauthenticatedHandler,
} from "../../test-utils/ledgerMocks.ts";
import App from "./App.tsx";

const meta = preview.meta({
  title: "Sidebar/App",
  component: App,
  decorators: [],
  loaders: [
    async (ctx) => {
      const serverUrl = (ctx.parameters.serverUrl as string | undefined) ?? MOCK_SERVER_URL;
      await setupBrowserMock({ serverUrl });
    },
  ],
});

export default meta;

export const UnauthedState = meta.story({
  name: "未認証画面",
  parameters: {
    msw: {
      handlers: [unauthenticatedHandler, ...masterHandlers],
    },
  },
});

export const MainState = meta.story({
  name: "メイン画面（ログイン済み）",
  parameters: {
    msw: {
      handlers: [meHandler, ...masterHandlers],
    },
  },
});
