import { useState } from "react";
import { describe, expect } from "vite-plus/test";
import { page } from "vite-plus/test/browser";
import { render } from "vitest-browser-react";
import { test } from "../test-utils/browser-test.ts";
import { setupBrowserMock } from "../test-utils/browser-mock.ts";
import { meHandler, MOCK_SERVER_URL, unauthenticatedHandler } from "../test-utils/ledgerMocks.ts";
import { SettingsOverlay } from "./SettingsOverlay.tsx";

const ControlledOverlay = ({ initialOpen = true }: { initialOpen?: boolean }) => {
  const [open, setOpen] = useState(initialOpen);
  return <SettingsOverlay open={open} onOpenChange={setOpen} />;
};

describe("SettingsOverlay", () => {
  test("openがtrueのときダイアログが表示される", async ({ worker }) => {
    await setupBrowserMock({ serverUrl: MOCK_SERVER_URL });
    worker.use(unauthenticatedHandler);

    await render(<ControlledOverlay />);

    await expect.element(page.getByRole("dialog")).toBeVisible();
    await expect.element(page.getByText("設定")).toBeVisible();
  });

  test("サーバーURLが未設定なら認証セクションが表示されない", async ({ worker: _worker }) => {
    await setupBrowserMock({ serverUrl: "" });

    await render(<ControlledOverlay />);

    await expect.element(page.getByText("サーバー URL")).toBeVisible();
    await expect.element(page.getByRole("button", { name: "ログイン" })).not.toBeInTheDocument();
  });

  test("ログイン済みならメールアドレスとログアウトボタンが表示される", async ({ worker }) => {
    await setupBrowserMock({ serverUrl: MOCK_SERVER_URL });
    worker.use(meHandler);

    await render(<ControlledOverlay />);

    await expect.element(page.getByText("user@example.com")).toBeVisible();
    await expect.element(page.getByRole("button", { name: "ログアウト" })).toBeVisible();
    await expect.element(page.getByText("Zaim 連携")).not.toBeInTheDocument();
  });

  test("未ログインならログインボタンが表示される", async ({ worker }) => {
    await setupBrowserMock({ serverUrl: MOCK_SERVER_URL });
    worker.use(unauthenticatedHandler);

    await render(<ControlledOverlay />);

    await expect.element(page.getByRole("button", { name: "ログイン" })).toBeVisible();
  });

  test("閉じるボタン押下でダイアログが閉じる", async ({ worker }) => {
    await setupBrowserMock({ serverUrl: MOCK_SERVER_URL });
    worker.use(unauthenticatedHandler);

    await render(<ControlledOverlay />);

    await expect.element(page.getByRole("dialog")).toBeVisible();
    await page.getByRole("button", { name: "閉じる" }).click();
    await expect.element(page.getByRole("dialog")).not.toBeInTheDocument();
  });
});
