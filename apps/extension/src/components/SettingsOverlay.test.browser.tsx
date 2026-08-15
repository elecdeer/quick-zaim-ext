import { http, HttpResponse } from "msw";
import { useState } from "react";
import { describe, expect } from "vite-plus/test";
import { page } from "vite-plus/test/browser";
import { render } from "vitest-browser-react";
import { test } from "../test-utils/browser-test.ts";
import { setupBrowserMock } from "../test-utils/browser-mock.ts";
import { SettingsOverlay } from "./SettingsOverlay.tsx";

const MOCK_SERVER_URL = "http://mock-server.test";

const ControlledOverlay = ({ initialOpen = true }: { initialOpen?: boolean }) => {
  const [open, setOpen] = useState(initialOpen);
  return <SettingsOverlay open={open} onOpenChange={setOpen} />;
};

describe("SettingsOverlay", () => {
  test("openがtrueのときダイアログが表示される", async ({ worker }) => {
    await setupBrowserMock({ serverUrl: MOCK_SERVER_URL });
    worker.use(http.get(`${MOCK_SERVER_URL}/me`, () => new HttpResponse(null, { status: 401 })));

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

  test("サーバーログイン済みでサーバー認証セクションが表示される", async ({ worker }) => {
    await setupBrowserMock({ serverUrl: MOCK_SERVER_URL });
    worker.use(
      http.get(`${MOCK_SERVER_URL}/me`, () =>
        HttpResponse.json({ email: "user@example.com", sub: "auth0|abc123" }),
      ),
      http.get(`${MOCK_SERVER_URL}/zaim/auth/status`, () =>
        HttpResponse.json({ connected: false }),
      ),
    );

    await render(<ControlledOverlay />);

    await expect.element(page.getByText("user@example.com")).toBeVisible();
    await expect.element(page.getByRole("button", { name: "Zaim でログイン" })).toBeVisible();
  });

  test("Zaim連携済みでZaimセクションが連携済み表示になる", async ({ worker }) => {
    await setupBrowserMock({ serverUrl: MOCK_SERVER_URL });
    worker.use(
      http.get(`${MOCK_SERVER_URL}/me`, () =>
        HttpResponse.json({ email: "user@example.com", sub: "auth0|abc123" }),
      ),
      http.get(`${MOCK_SERVER_URL}/zaim/auth/status`, () =>
        HttpResponse.json({ connected: true, zaimUserId: "zaim-user-001" }),
      ),
    );

    await render(<ControlledOverlay />);

    await expect.element(page.getByText("ユーザーID: zaim-user-001")).toBeVisible();
    await expect.element(page.getByRole("button", { name: "連携解除" })).toBeVisible();
  });

  test("閉じるボタン押下でダイアログが閉じる", async ({ worker }) => {
    await setupBrowserMock({ serverUrl: MOCK_SERVER_URL });
    worker.use(http.get(`${MOCK_SERVER_URL}/me`, () => new HttpResponse(null, { status: 401 })));

    await render(<ControlledOverlay />);

    await expect.element(page.getByRole("dialog")).toBeVisible();
    await page.getByRole("button", { name: "閉じる" }).click();
    await expect.element(page.getByRole("dialog")).not.toBeInTheDocument();
  });
});
