import { http, HttpResponse } from "msw";
import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import preview from "../../../../.storybook/preview";
import { setupBrowserMock } from "../../../test-utils/browser-mock.ts";
import UnauthedScreen from "./UnauthedScreen.tsx";

const MOCK_SERVER_URL = "http://mock-server.test";

const meta = preview.meta({
  title: "Sidebar/Screens/UnauthedScreen",
  component: UnauthedScreen,
  decorators: [
    (Story) => {
      const [queryClient] = useState(() => new QueryClient());
      return (
        <QueryClientProvider client={queryClient}>
          <div className="flex min-h-screen flex-col gap-4 bg-gray-50 p-4">
            <h1 className="text-lg font-bold text-gray-900">Quick Zaim</h1>
            <Story />
          </div>
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

export const NoServerUrl = meta.story({
  name: "URLなし",
  parameters: {
    serverUrl: "",
    msw: { handlers: [] },
  },
});

export const NotLoggedIn = meta.story({
  name: "未ログイン",
  parameters: {
    msw: {
      handlers: [http.get(`${MOCK_SERVER_URL}/me`, () => new HttpResponse(null, { status: 401 }))],
    },
  },
});

export const ServerLoggedIn = meta.story({
  name: "サーバーログイン済み・Zaim未連携",
  parameters: {
    msw: {
      handlers: [
        http.get(`${MOCK_SERVER_URL}/me`, () =>
          HttpResponse.json({ email: "user@example.com", sub: "auth0|abc123" }),
        ),
        http.get(`${MOCK_SERVER_URL}/zaim/auth/status`, () =>
          HttpResponse.json({ connected: false }),
        ),
      ],
    },
  },
});

export const NetworkError = meta.story({
  name: "サーバー接続エラー",
  parameters: {
    msw: {
      handlers: [http.get(`${MOCK_SERVER_URL}/me`, () => HttpResponse.error())],
    },
  },
});
