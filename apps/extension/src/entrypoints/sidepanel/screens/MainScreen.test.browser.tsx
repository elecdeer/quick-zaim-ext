import { describe, expect, test } from "vitest";
import { Default } from "./MainScreen.stories";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";

describe("MainScreen", () => {
  test("初期状態でヘッダーと登録ボタン（無効）が表示される", async () => {
    await render(<Default.Component />);

    await expect.element(page.getByText("品目名")).toBeVisible();
    await expect.element(page.getByText("金額")).toBeVisible();
    await expect.element(page.getByText("メモ")).toBeVisible();
    await expect.element(page.getByRole("button", { name: "登録" })).toBeDisabled();
  });

  test("金額を入力すると合計が更新される", async () => {
    await render(<Default.Component />);

    await page.getByPlaceholder("0").fill("1000");

    await expect.element(page.getByText("¥1,000")).toBeVisible();
  });

  test("品目を追加ボタンで入力行が増える", async () => {
    await render(<Default.Component />);

    await page.getByRole("button", { name: "+ 品目を追加" }).click();

    const nameInputs = page.getByPlaceholder("品目名");
    await expect.element(nameInputs.nth(0)).toBeVisible();
    await expect.element(nameInputs.nth(1)).toBeVisible();
  });

  test("有効な金額を入力すると登録ボタンが有効になる", async () => {
    await render(<Default.Component />);

    await page.getByPlaceholder("0").fill("500");

    await expect.element(page.getByRole("button", { name: "登録" })).toBeEnabled();
  });

  test("品目を削除すると行が減り合計がリセットされる", async () => {
    await render(<Default.Component />);

    await page.getByPlaceholder("0").fill("1000");
    await expect.element(page.getByText("¥1,000")).toBeVisible();

    await page.getByRole("button", { name: "品目を削除" }).click();

    await expect.element(page.getByText("¥0")).toBeVisible();
  });
});
