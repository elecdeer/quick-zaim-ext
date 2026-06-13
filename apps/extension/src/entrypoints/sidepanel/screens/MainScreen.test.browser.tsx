import { http, HttpResponse } from "msw";
import { describe, expect, test as baseTest, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
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

const noDuplicateHandler = http.get(`${MOCK_SERVER_URL}/api/zaim/payment/duplicate`, () =>
  HttpResponse.json({ duplicates: [] }),
);

const commonHandlers = [
  http.get(`${MOCK_SERVER_URL}/api/zaim/categories`, () =>
    HttpResponse.json(mockCategoriesResponse),
  ),
  http.get(`${MOCK_SERVER_URL}/api/zaim/accounts`, () => HttpResponse.json(mockAccountsResponse)),
  http.get(`${MOCK_SERVER_URL}/api/zaim/stores`, () => HttpResponse.json(mockStoresResponse)),
  noDuplicateHandler,
];

/** 1 行目のカテゴリ選択 → 金額入力まで行う共通セットアップ */
const fillMinimumForm = async () => {
  await page.getByRole("combobox", { name: "カテゴリ" }).click();
  await page.getByRole("option", { name: "食料品" }).click();
  await page.getByPlaceholder("0").fill("1000");
};

describe("MainScreen", () => {
  test("初期状態で登録ボタンが無効", async ({ worker }) => {
    worker.use(...commonHandlers);

    await render(<Default.Component />);

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

    // 初期は 1 行
    await expect.element(page.getByRole("button", { name: "品目を削除" })).toBeVisible();
    expect(page.getByRole("button", { name: "品目を削除" }).all().length).toBe(1);

    await page.getByRole("button", { name: "+ 品目を追加" }).click();

    expect(page.getByRole("button", { name: "品目を削除" }).all().length).toBe(2);
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

  test("登録ボタン押下でPOST APIが品目ごとのカテゴリで呼ばれる", async ({ worker }) => {
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

  test("重複検出時に警告と「重複があっても登録」ボタンが表示される", async ({ worker }) => {
    worker.use(
      ...commonHandlers.filter((h) => h !== noDuplicateHandler),
      http.get(`${MOCK_SERVER_URL}/api/zaim/payment/duplicate`, () =>
        HttpResponse.json({
          duplicates: [{ id: 1, date: "2024-01-09", amount: 1000 }],
        }),
      ),
    );

    await render(<Default.Component />);

    await fillMinimumForm();
    await page.getByRole("button", { name: "登録" }).click();

    await expect.element(page.getByRole("alert")).toHaveTextContent("直近で同額");
    await expect.element(page.getByRole("button", { name: "重複があっても登録" })).toBeVisible();
  });

  test("警告状態で再度ボタン押下するとPOSTが呼ばれる", async ({ worker }) => {
    const postHandler = vi.fn<(body: unknown) => void>();
    worker.use(
      ...commonHandlers.filter((h) => h !== noDuplicateHandler),
      http.get(`${MOCK_SERVER_URL}/api/zaim/payment/duplicate`, () =>
        HttpResponse.json({
          duplicates: [{ id: 1, date: "2024-01-09", amount: 1000 }],
        }),
      ),
      http.post(`${MOCK_SERVER_URL}/api/zaim/payment`, async ({ request }) => {
        postHandler(await request.json());
        return HttpResponse.json({ id: 999, modified: "2024-01-01T00:00:00Z" }, { status: 201 });
      }),
    );

    await render(<Default.Component />);

    await fillMinimumForm();
    await page.getByRole("button", { name: "登録" }).click();
    await expect.element(page.getByRole("button", { name: "重複があっても登録" })).toBeVisible();

    await page.getByRole("button", { name: "重複があっても登録" }).click();

    await vi.waitFor(() => {
      expect(postHandler).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 1000, genre_id: 1001 }),
      );
    });
  });

  test("警告表示中に金額を変更すると警告がクリアされる", async ({ worker }) => {
    worker.use(
      ...commonHandlers.filter((h) => h !== noDuplicateHandler),
      http.get(`${MOCK_SERVER_URL}/api/zaim/payment/duplicate`, () =>
        HttpResponse.json({
          duplicates: [{ id: 1, date: "2024-01-09", amount: 1000 }],
        }),
      ),
    );

    await render(<Default.Component />);

    await fillMinimumForm();
    await page.getByRole("button", { name: "登録" }).click();
    await expect.element(page.getByRole("button", { name: "重複があっても登録" })).toBeVisible();

    await page.getByPlaceholder("0").fill("2000");

    await expect.element(page.getByRole("button", { name: "登録" })).toBeVisible();
    await expect.element(page.getByRole("alert")).not.toBeInTheDocument();
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

  test("品目名と メモはモーダル経由で編集できる", async ({ worker }) => {
    worker.use(...commonHandlers);

    await render(<Default.Component />);

    // 品目名ボタンを押すと編集モーダルが開く
    await page.getByRole("button", { name: "品目名を編集" }).click();

    const nameInput = page.getByRole("textbox", { name: "品目名" });
    const commentInput = page.getByRole("textbox", { name: "メモ" });

    await nameInput.fill("りんご");
    await commentInput.fill("特売");
    await page.getByRole("button", { name: "保存" }).click();

    // 閉じた後、品目名ボタンに反映されている
    await expect
      .element(page.getByRole("button", { name: "品目名を編集" }))
      .toHaveTextContent("りんご");
  });

  test("品目ごとに異なるカテゴリを選んで登録できる", async ({ worker }) => {
    const postHandler = vi.fn<(body: unknown) => void>();
    worker.use(
      ...commonHandlers,
      http.post(`${MOCK_SERVER_URL}/api/zaim/payment`, async ({ request }) => {
        postHandler(await request.json());
        return HttpResponse.json({ id: 999, modified: "2024-01-01T00:00:00Z" }, { status: 201 });
      }),
    );

    await render(<Default.Component />);

    // 1 行目: カテゴリ=食料品, 金額=1000
    const firstCategory = page.getByRole("combobox", { name: "カテゴリ" }).first();
    await firstCategory.click();
    await page.getByRole("option", { name: "食料品" }).click();
    await page.getByPlaceholder("0").first().fill("1000");

    // 2 行目を追加し、カテゴリ=電車・バス, 金額=500
    await page.getByRole("button", { name: "+ 品目を追加" }).click();
    const secondCategory = page.getByRole("combobox", { name: "カテゴリ" }).nth(1);
    await secondCategory.click();
    await page.getByRole("option", { name: "電車・バス" }).click();
    await page.getByPlaceholder("0").nth(1).fill("500");

    await page.getByRole("button", { name: "登録" }).click();

    await vi.waitFor(() => {
      expect(postHandler).toHaveBeenCalledWith(
        expect.objectContaining({ genre_id: 1001, amount: 1000 }),
      );
      expect(postHandler).toHaveBeenCalledWith(
        expect.objectContaining({ genre_id: 1003, amount: 500 }),
      );
    });
  });
});

describe("MainScreen visual regression", () => {
  baseTest("初期状態", async () => {
    await render(<Default.Component />);
    await expect(page.elementLocator(document.body)).toMatchScreenshot("main-screen-initial");
  });

  baseTest("品目追加後", async () => {
    const screen = await render(<Default.Component />);
    await userEvent.click(screen.getByRole("button", { name: "+ 品目を追加" }));
    await expect(page.elementLocator(document.body)).toMatchScreenshot("main-screen-two-items");
  });

  baseTest("金額入力後", async () => {
    const screen = await render(<Default.Component />);
    await userEvent.fill(screen.getByPlaceholder("0"), "1000");
    await expect(page.elementLocator(document.body)).toMatchScreenshot("main-screen-with-amount");
  });
});
