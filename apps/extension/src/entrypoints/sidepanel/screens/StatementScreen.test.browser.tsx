import { http, HttpResponse } from "msw";
import { describe, expect } from "vite-plus/test";
import { page } from "vite-plus/test/browser";
import { render } from "vitest-browser-react";
import { test } from "../../../test-utils/browser-test.ts";
import { Default } from "./StatementScreen.stories";

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
        { id: 1002, name: "カフェ" },
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
      id: 2,
      name: "クレジットカード",
      active: 1,
      sort: 1,
      modified: "2024-01-01",
      localId: 0,
      websiteId: 0,
      parentAccountId: 0,
    },
  ],
};

const mockStoresResponse = {
  fetchedAt: "2024-01-01T00:00:00Z",
  stores: [
    { place: "スーパーA", placeUid: "uid-001", latestDate: "2026-04-10", count: 5 },
    { place: "カフェC 駅前店", placeUid: "uid-003", latestDate: "2026-03-01", count: 2 },
  ],
};

const commonHandlers = [
  http.get(`${MOCK_SERVER_URL}/api/zaim/categories`, () =>
    HttpResponse.json(mockCategoriesResponse),
  ),
  http.get(`${MOCK_SERVER_URL}/api/zaim/accounts`, () => HttpResponse.json(mockAccountsResponse)),
  http.get(`${MOCK_SERVER_URL}/api/zaim/stores`, () => HttpResponse.json(mockStoresResponse)),
  http.post(`${MOCK_SERVER_URL}/api/llm/extract-statement`, () =>
    HttpResponse.json({
      accountId: 2,
      rows: [
        {
          date: "2026-05-01",
          place: "ｽｰﾊﾟｰA",
          placeUid: "uid-001",
          amount: 1200,
          genreId: 1001,
        },
        { date: "2026-05-02", place: "JR東日本", placeUid: null, amount: 300, genreId: 1003 },
        { date: "2026-05-03", place: "カフェC", placeUid: null, amount: 450, genreId: 1002 },
        { date: null, place: "読み取れない行", placeUid: null, amount: null, genreId: null },
      ],
      confidence: "high",
      reasoning: "",
    }),
  ),
  // 2 行目（JR東日本）だけ登録済み
  http.post(`${MOCK_SERVER_URL}/api/zaim/payment/duplicate/bulk`, () =>
    HttpResponse.json({
      results: [
        { match: null },
        {
          match: {
            id: 50,
            date: "2026-05-02",
            amount: 300,
            place: "",
            placeUid: "",
            mode: "payment",
            categoryId: 102,
            genreId: 1003,
          },
        },
        { match: null },
      ],
    }),
  ),
];

type PaymentRequestBody = {
  amount: number;
  date: string;
  genre_id: number;
  from_account_id?: number;
  name?: string;
  place_uid?: string;
};

/** 登録リクエストの body を記録し、`failOnCall` 回目だけ 500 を返すハンドラー */
const recordPaymentHandler = (failOnCall?: number) => {
  const bodies: PaymentRequestBody[] = [];
  const handler = http.post(`${MOCK_SERVER_URL}/api/zaim/payment`, async ({ request }) => {
    bodies.push((await request.json()) as PaymentRequestBody);
    if (bodies.length === failOnCall) return new HttpResponse(null, { status: 500 });
    return HttpResponse.json({ id: 999, modified: "2026-06-01T00:00:00Z" }, { status: 201 });
  });
  return { handler, bodies };
};

/** 利用先名で行を特定し、その行の店舗欄を返す */
const storeOf = (place: string) =>
  page.getByRole("listitem").filter({ hasText: place }).getByRole("combobox", { name: "店舗" });

const extract = async () => {
  await page.getByRole("button", { name: "このページの明細を読み取る" }).click();
  await expect.element(page.getByText("JR東日本")).toBeVisible();
};

describe("StatementScreen", () => {
  test("読み取ると明細行を表示し、登録済みの行は選択を外す", async ({ worker }) => {
    worker.use(...commonHandlers);
    await render(<Default.Component />);

    await extract();

    await expect
      .element(page.getByRole("checkbox", { name: "ｽｰﾊﾟｰA（5/1）を登録する" }))
      .toBeChecked();
    await expect
      .element(page.getByRole("checkbox", { name: "JR東日本（5/2）を登録する" }))
      .not.toBeChecked();
    await expect.element(page.getByText("登録済み 5/2")).toBeVisible();
    // AI が推測した既存店舗が選ばれ、推測できなかった行は未選択
    await expect.element(storeOf("ｽｰﾊﾟｰA")).toHaveTextContent("スーパーA");
    await expect.element(storeOf("カフェC")).toHaveTextContent("店舗を選択（任意）");
    await expect
      .element(page.getByRole("status").filter({ hasText: "件読み取りました" }))
      .toHaveTextContent(
        "3件読み取りました（うち1件は登録済みのため選択を外しました）。日付・金額を読み取れなかった1件は除外しました",
      );
    await expect.element(page.getByRole("button", { name: "2件を登録" })).toBeEnabled();
  });

  test("選択した行だけを読み取った口座で登録し、店舗に紐付かない利用先は品名にする", async ({
    worker,
  }) => {
    const { handler, bodies } = recordPaymentHandler();
    worker.use(...commonHandlers, handler);
    await render(<Default.Component />);
    await extract();

    await page.getByRole("button", { name: "2件を登録" }).click();

    await expect
      .element(page.getByRole("status").filter({ hasText: "2件登録しました" }))
      .toBeInTheDocument();
    expect(bodies).toEqual([
      {
        category_id: 101,
        genre_id: 1001,
        amount: 1200,
        date: "2026-05-01",
        from_account_id: 2,
        place_uid: "uid-001",
      },
      {
        category_id: 101,
        genre_id: 1002,
        amount: 450,
        date: "2026-05-03",
        from_account_id: 2,
        name: "カフェC",
      },
    ]);
    expect(page.getByText("登録しました", { exact: true }).all().length).toBe(2);
    await expect.element(page.getByRole("button", { name: "0件を登録" })).toBeDisabled();
  });

  test("登録済みと判定された行も選択し直せば登録できる", async ({ worker }) => {
    const { handler, bodies } = recordPaymentHandler();
    worker.use(...commonHandlers, handler);
    await render(<Default.Component />);
    await extract();

    await page.getByRole("checkbox", { name: "JR東日本（5/2）を登録する" }).click();
    await page.getByRole("button", { name: "3件を登録" }).click();

    await expect
      .element(page.getByRole("status").filter({ hasText: "3件登録しました" }))
      .toBeInTheDocument();
    expect(bodies.map((body) => body.amount)).toEqual([1200, 300, 450]);
  });

  test("途中で登録に失敗するとエラーを表示し、登録できた行は選択から外れる", async ({ worker }) => {
    const { handler } = recordPaymentHandler(2);
    worker.use(...commonHandlers, handler);
    await render(<Default.Component />);
    await extract();

    await page.getByRole("button", { name: "2件を登録" }).click();

    await expect
      .element(page.getByRole("alert"))
      .toHaveTextContent("「カフェC」の登録に失敗しました（500）");
    await expect
      .element(page.getByRole("checkbox", { name: "ｽｰﾊﾟｰA（5/1）を登録する" }))
      .not.toBeChecked();
    await expect
      .element(page.getByRole("checkbox", { name: "カフェC（5/3）を登録する" }))
      .toBeChecked();
    await expect.element(page.getByRole("button", { name: "1件を登録" })).toBeEnabled();
  });

  test("行ごとに店舗を選び直して登録できる", async ({ worker }) => {
    const { handler, bodies } = recordPaymentHandler();
    worker.use(...commonHandlers, handler);
    await render(<Default.Component />);
    await extract();

    await page
      .getByRole("listitem")
      .filter({ hasText: "ｽｰﾊﾟｰA" })
      .getByRole("button", { name: "クリア" })
      .click();
    await storeOf("カフェC").click();
    await page.getByRole("option", { name: "カフェC 駅前店" }).click();
    await page.getByRole("button", { name: "2件を登録" }).click();

    await expect
      .element(page.getByRole("status").filter({ hasText: "2件登録しました" }))
      .toBeInTheDocument();
    expect(bodies.map(({ name, place_uid }) => ({ name, place_uid }))).toEqual([
      { name: "ｽｰﾊﾟｰA", place_uid: undefined },
      { name: undefined, place_uid: "uid-003" },
    ]);
  });
});
