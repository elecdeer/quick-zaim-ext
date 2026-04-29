import { http, HttpResponse } from "msw";
import preview from "../../../.storybook/preview";
import { setupBrowserMock } from "../../test-utils/browser-mock.ts";
import App from "./App.tsx";

const MOCK_SERVER_URL = "http://mock-server.test";
const FIXED_FETCHED_AT = "2024-01-01T00:00:00.000Z";

const meta = preview.meta({
  title: "Sidebar/App",
  component: App,
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

export const FullyConnected = meta.story({
  name: "完全連携済み",
  parameters: {
    msw: {
      handlers: [
        http.get(`${MOCK_SERVER_URL}/me`, () =>
          HttpResponse.json({ email: "user@example.com", sub: "auth0|abc123" }),
        ),
        http.get(`${MOCK_SERVER_URL}/zaim/auth/status`, () =>
          HttpResponse.json({ connected: true, zaimUserId: "zaim_user_123456" }),
        ),
        http.get(`${MOCK_SERVER_URL}/api/zaim/categories`, () =>
          HttpResponse.json({
            fetchedAt: FIXED_FETCHED_AT,
            categories: [
              {
                id: 101,
                name: "食費",
                mode: "payment",
                subCategories: [
                  { id: 1011, name: "食料品" },
                  { id: 1012, name: "外食" },
                  { id: 1013, name: "カフェ" },
                ],
              },
              {
                id: 102,
                name: "日用品",
                mode: "payment",
                subCategories: [
                  { id: 1021, name: "消耗品" },
                  { id: 1022, name: "家具・家電" },
                ],
              },
              {
                id: 103,
                name: "交通費",
                mode: "payment",
                subCategories: [
                  { id: 1031, name: "電車" },
                  { id: 1032, name: "バス" },
                  { id: 1033, name: "タクシー" },
                ],
              },
            ],
          }),
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

export const CategoriesLoading = meta.story({
  name: "カテゴリ読み込み中",
  parameters: {
    msw: {
      handlers: [
        http.get(`${MOCK_SERVER_URL}/me`, () =>
          HttpResponse.json({ email: "user@example.com", sub: "auth0|abc123" }),
        ),
        http.get(`${MOCK_SERVER_URL}/zaim/auth/status`, () =>
          HttpResponse.json({ connected: true, zaimUserId: "zaim_user_123456" }),
        ),
        http.get(`${MOCK_SERVER_URL}/api/zaim/categories`, async () => {
          // Never resolves to keep loading state visible indefinitely
          await new Promise<never>(() => {});
          return HttpResponse.json({ fetchedAt: "", categories: [] });
        }),
      ],
    },
  },
});
