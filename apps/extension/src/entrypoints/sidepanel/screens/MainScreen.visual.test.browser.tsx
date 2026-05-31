import { describe, expect, test } from "vitest";
import { page } from "vitest/browser";
import { render } from "vitest-browser-react";
import { Default } from "./MainScreen.stories";

describe("MainScreen visual regression", () => {
  test("初期状態", async () => {
    await render(<Default.Component />);
    await expect(page.elementLocator(document.body)).toMatchScreenshot("main-screen-initial");
  });

  test("品目追加後", async () => {
    await render(<Default.Component />);
    await page.getByRole("button", { name: "+ 品目を追加" }).click();
    await expect(page.elementLocator(document.body)).toMatchScreenshot("main-screen-two-items");
  });

  test("金額入力後", async () => {
    await render(<Default.Component />);
    await page.getByPlaceholder("0").fill("1000");
    await expect(page.elementLocator(document.body)).toMatchScreenshot("main-screen-with-amount");
  });
});
