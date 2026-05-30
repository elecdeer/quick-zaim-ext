import { http, HttpResponse } from "msw";
import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import preview from "#storybook/preview";
import { setupBrowserMock } from "../../test-utils/browser-mock.ts";
import App from "./App.tsx";

const MOCK_SERVER_URL = "http://mock-server.test";

const meta = preview.meta({
  title: "Sidebar/App",
  component: App,
  decorators: [
    (Story) => {
      const [queryClient] = useState(() => new QueryClient());
      return (
        <QueryClientProvider client={queryClient}>
          <Story />
        </QueryClientProvider>
      );
    },
  ],
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
      handlers: [http.get(`${MOCK_SERVER_URL}/me`, () => new HttpResponse(null, { status: 401 }))],
    },
  },
});

export const MainState = meta.story({
  name: "メイン画面（Zaim連携済み）",
  parameters: {
    msw: {
      handlers: [
        http.get(`${MOCK_SERVER_URL}/me`, () =>
          HttpResponse.json({ email: "user@example.com", sub: "auth0|abc123" }),
        ),
        http.get(`${MOCK_SERVER_URL}/zaim/auth/status`, () =>
          HttpResponse.json({ connected: true, zaimUserId: "zaim_user_123456" }),
        ),
      ],
    },
  },
});
