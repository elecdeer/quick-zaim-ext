import { http, HttpResponse } from "msw";
import { describe, expect } from "vite-plus/test";
import { page } from "vite-plus/test/browser";
import { render } from "vitest-browser-react";
import { test } from "../../test-utils/browser-test.ts";
import { setupBrowserMock } from "../../test-utils/browser-mock.ts";
import App from "./App.tsx";

const MOCK_SERVER_URL = "http://mock-server.test";

const noopZaimDataHandlers = [
  http.get(`${MOCK_SERVER_URL}/api/zaim/categories`, () =>
    HttpResponse.json({ fetchedAt: "2024-01-01T00:00:00Z", categories: [] }),
  ),
  http.get(`${MOCK_SERVER_URL}/api/zaim/accounts`, () =>
    HttpResponse.json({ fetchedAt: "2024-01-01T00:00:00Z", accounts: [] }),
  ),
  http.get(`${MOCK_SERVER_URL}/api/zaim/stores`, () =>
    HttpResponse.json({ fetchedAt: "2024-01-01T00:00:00Z", stores: [] }),
  ),
];

describe("App: 設定オーバーレイの自動オープン", () => {
  test("Zaim 連携済みのとき設定ダイアログは開かない", async ({ worker }) => {
    await setupBrowserMock({ serverUrl: MOCK_SERVER_URL });
    worker.use(
      ...noopZaimDataHandlers,
      http.get(`${MOCK_SERVER_URL}/me`, () =>
        HttpResponse.json({ email: "user@example.com", sub: "auth0|abc123" }),
      ),
      http.get(`${MOCK_SERVER_URL}/zaim/auth/status`, () =>
        HttpResponse.json({ connected: true, zaimUserId: "zaim_user_123456" }),
      ),
    );

    await render(<App />);

    await expect.element(page.getByRole("heading", { name: "Quick Zaim" })).toBeVisible();
    await expect.element(page.getByRole("dialog", { name: "設定" })).not.toBeInTheDocument();
  });

  test("未認証のとき設定ダイアログが自動で開く", async ({ worker }) => {
    await setupBrowserMock({ serverUrl: MOCK_SERVER_URL });
    worker.use(
      ...noopZaimDataHandlers,
      http.get(`${MOCK_SERVER_URL}/me`, () => new HttpResponse(null, { status: 401 })),
    );

    await render(<App />);

    await expect.element(page.getByRole("dialog", { name: "設定" })).toBeVisible();
  });
});
