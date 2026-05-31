import { afterEach, describe, expect, test } from "vitest";
import type { Parameters } from "@storybook/react";
import { getWorker } from "msw-storybook-addon";
import { page } from "vitest/browser";
import { render } from "vitest-browser-react";
import { setupBrowserMock } from "../../../test-utils/browser-mock.ts";
import { NetworkError, NoServerUrl, NotLoggedIn, ServerLoggedIn } from "./UnauthedScreen.stories";

const MOCK_SERVER_URL = "http://mock-server.test";

/**
 * ストーリーの composed.parameters から MSW とストレージのセットアップを行う。
 * Parameters は Storybook の Record<string, any> 型。
 */
const setupFromStoryParameters = async (parameters: Parameters): Promise<void> => {
  await setupBrowserMock({ serverUrl: parameters.serverUrl ?? MOCK_SERVER_URL });
  getWorker().use(...(parameters.msw?.handlers ?? []));
};

afterEach(() => {
  getWorker().resetHandlers();
});

describe("UnauthedScreen visual regression", () => {
  test("URLなし状態", async () => {
    await setupFromStoryParameters(NoServerUrl.composed.parameters);
    const screen = await render(<NoServerUrl.Component />);
    await expect.element(screen.getByPlaceholder("https://your-server.workers.dev")).toBeVisible();
    await expect(page.elementLocator(document.body)).toMatchScreenshot("unauthed-screen-no-url");
  });

  test("未ログイン状態", async () => {
    await setupFromStoryParameters(NotLoggedIn.composed.parameters);
    const screen = await render(<NotLoggedIn.Component />);
    await expect.element(screen.getByRole("button", { name: "ログイン" })).toBeEnabled();
    await expect(page.elementLocator(document.body)).toMatchScreenshot(
      "unauthed-screen-not-logged-in",
    );
  });

  test("サーバーログイン済み・Zaim未連携", async () => {
    await setupFromStoryParameters(ServerLoggedIn.composed.parameters);
    const screen = await render(<ServerLoggedIn.Component />);
    await expect.element(screen.getByRole("button", { name: "Zaim でログイン" })).toBeVisible();
    await expect(page.elementLocator(document.body)).toMatchScreenshot(
      "unauthed-screen-server-logged-in",
    );
  });

  test("サーバー接続エラー", async () => {
    await setupFromStoryParameters(NetworkError.composed.parameters);
    const screen = await render(<NetworkError.Component />);
    await expect.element(screen.getByRole("button", { name: "ログイン" })).toBeEnabled();
    await expect(page.elementLocator(document.body)).toMatchScreenshot(
      "unauthed-screen-network-error",
    );
  });
});
