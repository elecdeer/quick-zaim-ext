import { http, HttpResponse } from "msw";
import { describe, expect, vi } from "vitest";
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

/** カテゴリ選択 → 金額入力まで行う共通セットアップ */
const fillMinimumForm = async () => {
  await page.getByRole("combobox", { name: "カテゴリ" }).click();
  await page.getByRole("option", { name: "食費" }).click();
  await page.getByRole("combobox", { name: "サブカテゴリ" }).click();
  await page.getByRole("option", { name: "食料品" }).click();
  await page.getByPlaceholder("0").fill("1000");
};

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

  test("カテゴリと金額を入力すると登録ボタンが有効になる", async ({ worker }) => {
    worker.use(...commonHandlers);

    await render(<Default.Component />);

    await fillMinimumForm();

    await expect.element(page.getByRole("button", { name: "登録" })).toBeEnabled();
  });

  test("登録ボタン押下でPOST APIが呼ばれる", async ({ worker }) => {
    const postHandler = vi.fn<(body: unknown) => void>();
    worker.use(
      ...commonHandlers,
      http.post(`${MOCK_SERVER_URL}/api/zaim/payment`, async ({ request }) => {
        postHandler(await request.json());
        return HttpResponse.json({ id: 999, modified: "2024-01-01T00:00:00Z" }, { status: 201 });
      }),
    );

    await render(<Default.Component />);

    await fillMinimumForm();
    await page.getByRole("button", { name: "登録" }).click();

    await vi.waitFor(() => {
      expect(postHandler).toHaveBeenCalledWith(
        expect.objectContaining({ category_id: 101, genre_id: 1001, amount: 1000 }),
      );
    });
  });

  test("登録成功時に成功メッセージが表示されフォームがリセットされる", async ({ worker }) => {
    worker.use(
      ...commonHandlers,
      http.post(`${MOCK_SERVER_URL}/api/zaim/payment`, () =>
        HttpResponse.json({ id: 999, modified: "2024-01-01T00:00:00Z" }, { status: 201 }),
      ),
    );

    await render(<Default.Component />);

    await fillMinimumForm();
    await page.getByRole("button", { name: "登録" }).click();

    await expect.element(page.getByRole("status")).toHaveTextContent("登録しました");

    // フォームがリセットされ登録ボタンが再び無効になる
    await expect.element(page.getByRole("button", { name: "登録" })).toBeDisabled();
  });

  test("登録失敗時にエラーメッセージが表示される", async ({ worker }) => {
    worker.use(
      ...commonHandlers,
      http.post(
        `${MOCK_SERVER_URL}/api/zaim/payment`,
        () => new HttpResponse(null, { status: 502 }),
      ),
    );

    await render(<Default.Component />);

    await fillMinimumForm();
    await page.getByRole("button", { name: "登録" }).click();

    await expect.element(page.getByRole("alert")).toHaveTextContent("登録に失敗しました（502）");
  });
});
