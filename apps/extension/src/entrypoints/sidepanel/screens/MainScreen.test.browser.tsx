import { http, HttpResponse } from "msw";
import { describe, expect } from "vitest";
import { page } from "vitest/browser";
import { render } from "vitest-browser-react";
import { test } from "../../../test-utils/browser-test.ts";
import { Default } from "./MainScreen.stories";

const MOCK_SERVER_URL = "http://mock-server.test";

const mockCategoriesResponse = {
  fetchedAt: "2024-01-01T00:00:00Z",
  categories: [
    {
      id: 101,
      name: "食費",
      mode: "payment",
      subCategories: [
        { id: 1001, name: "食料品" },
        { id: 1002, name: "外食" },
      ],
    },
    {
      id: 102,
      name: "交通費",
      mode: "payment",
      subCategories: [{ id: 1003, name: "電車・バス" }],
    },
  ],
};

const mockAccountsResponse = {
  fetchedAt: "2024-01-01T00:00:00Z",
  accounts: [
    {
      id: 1,
      name: "現金",
      active: 1,
      sort: 1,
      modified: "2024-01-01",
      localId: 0,
      websiteId: 0,
      parentAccountId: 0,
    },
    {
      id: 2,
      name: "クレジットカード",
      active: 1,
      sort: 2,
      modified: "2024-01-01",
      localId: 0,
      websiteId: 0,
      parentAccountId: 0,
    },
  ],
};

const mockStoresResponse = {
  fetchedAt: "2024-01-01T00:00:00Z",
  stores: [{ place: "スーパーA", placeUid: "uid-001", latestDate: "2024-01-10", count: 5 }],
};

const commonHandlers = [
  http.get(`${MOCK_SERVER_URL}/api/zaim/categories`, () =>
    HttpResponse.json(mockCategoriesResponse),
  ),
  http.get(`${MOCK_SERVER_URL}/api/zaim/accounts`, () => HttpResponse.json(mockAccountsResponse)),
  http.get(`${MOCK_SERVER_URL}/api/zaim/stores`, () => HttpResponse.json(mockStoresResponse)),
];

describe("MainScreen", () => {
  test("初期状態でヘッダーと登録ボタン（無効）が表示される", async ({ worker }) => {
    worker.use(...commonHandlers);

    await render(<Default.Component />);

    await expect.element(page.getByText("品目名")).toBeVisible();
    await expect.element(page.getByText("金額")).toBeVisible();
    await expect.element(page.getByText("メモ")).toBeVisible();
    await expect.element(page.getByRole("button", { name: "登録" })).toBeDisabled();
  });

  test("金額を入力すると合計が更新される", async ({ worker }) => {
    worker.use(...commonHandlers);

    await render(<Default.Component />);

    await page.getByPlaceholder("0").fill("1000");

    await expect.element(page.getByText("¥1,000")).toBeVisible();
  });

  test("品目を追加ボタンで入力行が増える", async ({ worker }) => {
    worker.use(...commonHandlers);

    await render(<Default.Component />);

    await page.getByRole("button", { name: "+ 品目を追加" }).click();

    const nameInputs = page.getByPlaceholder("品目名");
    await expect.element(nameInputs.nth(0)).toBeVisible();
    await expect.element(nameInputs.nth(1)).toBeVisible();
  });

  test("品目を削除すると行が減り合計がリセットされる", async ({ worker }) => {
    worker.use(...commonHandlers);

    await render(<Default.Component />);

    await page.getByPlaceholder("0").fill("1000");
    await expect.element(page.getByText("¥1,000")).toBeVisible();

    await page.getByRole("button", { name: "品目を削除" }).click();

    await expect.element(page.getByText("¥0")).toBeVisible();
  });
});
