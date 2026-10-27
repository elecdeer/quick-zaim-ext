import { http, HttpResponse } from "msw";
import { userEvent, within } from "storybook/test";
import preview from "#storybook/preview";
import { Toaster, ToastProvider } from "@/components/ui/toast";
import StatementScreen from "./StatementScreen.tsx";

const MOCK_SERVER_URL = "http://mock-server.test";

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

const mockStoresResponse = {
  fetchedAt: "2024-01-01T00:00:00Z",
  stores: [
    { place: "スーパーA", placeUid: "uid-001", latestDate: "2026-04-10", count: 5 },
    { place: "カフェC 駅前店", placeUid: "uid-003", latestDate: "2026-03-01", count: 2 },
  ],
};

const categoriesHandler = http.get(`${MOCK_SERVER_URL}/api/zaim/categories`, () =>
  HttpResponse.json(mockCategoriesResponse),
);

const accountsHandler = http.get(`${MOCK_SERVER_URL}/api/zaim/accounts`, () =>
  HttpResponse.json(mockAccountsResponse),
);

const storesHandler = http.get(`${MOCK_SERVER_URL}/api/zaim/stores`, () =>
  HttpResponse.json(mockStoresResponse),
);

const extractStatementHandler = http.post(`${MOCK_SERVER_URL}/api/llm/extract-statement`, () =>
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
);

/** 2 行目（JR東日本）だけ登録済みとして返す */
const bulkDuplicateHandler = http.post(`${MOCK_SERVER_URL}/api/zaim/payment/duplicate/bulk`, () =>
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
);

const paymentHandler = http.post(`${MOCK_SERVER_URL}/api/zaim/payment`, () =>
  HttpResponse.json({ id: 999, modified: "2026-06-01T00:00:00Z" }, { status: 201 }),
);

/**
 * collectFromActiveTab() が叩く chrome.* API を成功レスポンスでスタブする。
 * preview.ts で globalThis.chrome = fakeBrowser されているため、その上にメソッドを上書きする。
 */
const stubCollectFromActiveTab = () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chromeAny = globalThis.chrome as any;
  chromeAny.tabs.query = async () => [{ id: 1, url: "https://example.com/statement" }];
  chromeAny.scripting = chromeAny.scripting ?? {};
  chromeAny.scripting.executeScript = async () => [];
  chromeAny.tabs.sendMessage = async () => ({
    ok: true,
    url: "https://example.com/statement",
    title: "ご利用明細",
    ariaSnapshot: "",
    collectedAt: new Date().toISOString(),
  });
};

const meta = preview.meta({
  title: "Sidebar/Screens/StatementScreen",
  component: StatementScreen,
  args: {
    serverUrl: MOCK_SERVER_URL,
  },
  decorators: [
    (Story) => {
      stubCollectFromActiveTab();
      return (
        <ToastProvider>
          <div className="flex min-h-screen flex-col gap-4 bg-gray-50 p-4">
            <h1 className="text-lg font-bold text-gray-900">Quick Zaim</h1>
            <Story />
            <Toaster />
          </div>
        </ToastProvider>
      );
    },
  ],
});

export default meta;

const handlers = [
  categoriesHandler,
  accountsHandler,
  storesHandler,
  extractStatementHandler,
  bulkDuplicateHandler,
  paymentHandler,
];

export const Default = meta.story({
  name: "読み取り前",
  parameters: { msw: { handlers } },
});

export const Extracted = meta.story({
  name: "読み取り後（登録済みあり）",
  parameters: { msw: { handlers } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = await canvas.findByRole("button", { name: "このページの明細を読み取る" });
    await userEvent.click(button);
    await canvas.findByText("JR東日本");
  },
});
