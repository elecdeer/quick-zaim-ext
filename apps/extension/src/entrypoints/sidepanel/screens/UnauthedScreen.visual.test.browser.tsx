import { afterEach, describe, expect, test } from "vitest";
import { http, HttpResponse } from "msw";
import { getWorker } from "msw-storybook-addon";
import { page } from "vitest/browser";
import { render } from "vitest-browser-react";
import { setupBrowserMock } from "../../../test-utils/browser-mock.ts";
import { NetworkError, NoServerUrl, NotLoggedIn, ServerLoggedIn } from "./UnauthedScreen.stories";

const MOCK_SERVER_URL = "http://mock-server.test";

// .Component はstory loaderを実行しないため、storage とMSWを手動でセットアップする
afterEach(() => {
  getWorker().resetHandlers();
});

describe("UnauthedScreen visual regression", () => {
  test("URLなし状態", async () => {
    await setupBrowserMock({ serverUrl: "" });
    await render(<NoServerUrl.Component />);
    await expect.element(page.getByPlaceholder("https://your-server.workers.dev")).toBeVisible();
    await expect(page.elementLocator(document.body)).toMatchScreenshot("unauthed-screen-no-url");
  });

  test("未ログイン状態", async () => {
    await setupBrowserMock({ serverUrl: MOCK_SERVER_URL });
    getWorker().use(
      http.get(`${MOCK_SERVER_URL}/me`, () => new HttpResponse(null, { status: 401 })),
    );
    await render(<NotLoggedIn.Component />);
    await expect.element(page.getByRole("button", { name: "ログイン" })).toBeEnabled();
    await expect(page.elementLocator(document.body)).toMatchScreenshot(
      "unauthed-screen-not-logged-in",
    );
  });

  test("サーバーログイン済み・Zaim未連携", async () => {
    await setupBrowserMock({ serverUrl: MOCK_SERVER_URL });
    getWorker().use(
      http.get(`${MOCK_SERVER_URL}/me`, () =>
        HttpResponse.json({ email: "user@example.com", sub: "auth0|abc123" }),
      ),
      http.get(`${MOCK_SERVER_URL}/zaim/auth/status`, () =>
        HttpResponse.json({ connected: false }),
      ),
    );
    await render(<ServerLoggedIn.Component />);
    await expect.element(page.getByRole("button", { name: "Zaim でログイン" })).toBeVisible();
    await expect(page.elementLocator(document.body)).toMatchScreenshot(
      "unauthed-screen-server-logged-in",
    );
  });

  test("サーバー接続エラー", async () => {
    await setupBrowserMock({ serverUrl: MOCK_SERVER_URL });
    getWorker().use(http.get(`${MOCK_SERVER_URL}/me`, () => HttpResponse.error()));
    await render(<NetworkError.Component />);
    await expect.element(page.getByRole("button", { name: "ログイン" })).toBeEnabled();
    await expect(page.elementLocator(document.body)).toMatchScreenshot(
      "unauthed-screen-network-error",
    );
  });
});
