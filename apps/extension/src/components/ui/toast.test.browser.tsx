import { describe, expect, test } from "vite-plus/test";
import { page } from "vite-plus/test/browser";
import { render } from "vitest-browser-react";
import { Toaster, ToastProvider, useToastManager } from "./toast.tsx";

const AddToastButton = () => {
  const toastManager = useToastManager();
  return (
    <button type="button" onClick={() => toastManager.add({ description: "登録しました" })}>
      通知
    </button>
  );
};

describe("Toaster", () => {
  test("トーストが文言を読める幅で表示される", async () => {
    await page.viewport(380, 800);
    await render(
      <ToastProvider>
        <AddToastButton />
        <Toaster />
      </ToastProvider>,
    );
    await page.getByRole("button", { name: "通知" }).click();

    const toast = page.getByRole("status").filter({ hasText: "登録しました" });
    await expect.element(toast).toBeVisible();
    // ビューポートが内容に合わせて縮むと、absolute 配置のトーストが幅 0 に潰れる
    expect(toast.element().getBoundingClientRect().width).toBeGreaterThan(200);
  });
});
