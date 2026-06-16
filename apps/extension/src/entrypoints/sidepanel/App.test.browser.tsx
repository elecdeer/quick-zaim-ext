import { http, HttpResponse } from "msw";
import { describe, expect } from "vitest";
import { page } from "vitest/browser";
import { render } from "vitest-browser-react";
import { test } from "../../test-utils/browser-test.ts";
import { MainState, UnauthedState } from "./App.stories";

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
    worker.use(...noopZaimDataHandlers);

    await render(<MainState.Component />);

    // ヘッダーが描画されるまで待つ（auth クエリの解決待ち）
    await expect.element(page.getByRole("heading", { name: "Quick Zaim" })).toBeVisible();

    // 設定ダイアログのタイトルが表示されないこと
    await expect.element(page.getByRole("dialog", { name: "設定" })).not.toBeInTheDocument();
  });

  test("未認証のとき設定ダイアログが自動で開く", async ({ worker }) => {
    worker.use(...noopZaimDataHandlers);

    await render(<UnauthedState.Component />);

    await expect.element(page.getByRole("dialog", { name: "設定" })).toBeVisible();
  });
});
