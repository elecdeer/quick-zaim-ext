import { describe, expect } from "vitest";
import type { Parameters } from "@storybook/react";
import { page } from "vitest/browser";
import { render } from "vitest-browser-react";
import { test } from "../../../test-utils/browser-test.ts";
import { setupBrowserMock } from "../../../test-utils/browser-mock.ts";
import { NetworkError, NoServerUrl, NotLoggedIn, ServerLoggedIn } from "./UnauthedScreen.stories";

const MOCK_SERVER_URL = "http://mock-server.test";

/**
 * ストーリーの composed.parameters から MSW とストレージのセットアップを行う。
 * Parameters は Storybook の Record<string, any> 型。
 */
const setupFromStoryParameters = async (
  worker: ReturnType<typeof import("msw-storybook-addon").getWorker>,
  parameters: Parameters,
): Promise<void> => {
  await setupBrowserMock({ serverUrl: parameters.serverUrl ?? MOCK_SERVER_URL });
  worker.use(...(parameters.msw?.handlers ?? []));
};

describe("UnauthedScreen visual regression", () => {
  test("URLなし状態", async ({ worker }) => {
    await setupFromStoryParameters(worker, NoServerUrl.composed.parameters);
    const screen = await render(<NoServerUrl.Component />);
    await expect.element(screen.getByPlaceholder("https://your-server.workers.dev")).toBeVisible();
    await expect(page.elementLocator(document.body)).toMatchScreenshot("unauthed-screen-no-url");
  });

  test("未ログイン状態", async ({ worker }) => {
    await setupFromStoryParameters(worker, NotLoggedIn.composed.parameters);
    const screen = await render(<NotLoggedIn.Component />);
    await expect.element(screen.getByRole("button", { name: "ログイン" })).toBeEnabled();
    await expect(page.elementLocator(document.body)).toMatchScreenshot(
      "unauthed-screen-not-logged-in",
    );
  });

  test("サーバーログイン済み・Zaim未連携", async ({ worker }) => {
    await setupFromStoryParameters(worker, ServerLoggedIn.composed.parameters);
    const screen = await render(<ServerLoggedIn.Component />);
    await expect.element(screen.getByRole("button", { name: "Zaim でログイン" })).toBeVisible();
    await expect(page.elementLocator(document.body)).toMatchScreenshot(
      "unauthed-screen-server-logged-in",
    );
  });

  test("サーバー接続エラー", async ({ worker }) => {
    await setupFromStoryParameters(worker, NetworkError.composed.parameters);
    const screen = await render(<NetworkError.Component />);
    await expect.element(screen.getByRole("button", { name: "ログイン" })).toBeEnabled();
    await expect(page.elementLocator(document.body)).toMatchScreenshot(
      "unauthed-screen-network-error",
    );
  });
});
