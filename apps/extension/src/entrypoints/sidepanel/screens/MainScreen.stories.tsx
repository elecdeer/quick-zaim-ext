import { http, HttpResponse } from "msw";
import { userEvent, within } from "storybook/test";
import preview from "#storybook/preview";
import { Toaster, ToastProvider } from "@/components/ui/toast";
import MainScreen from "./MainScreen.tsx";

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
    {
      id: 3,
      name: "Suica",
      active: 1,
      sort: 3,
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
        { id: 1002, name: "外食" },
      ],
    },
    {
      id: 102,
      name: "交通費",
      mode: "payment",
      subCategories: [{ id: 1003, name: "電車・バス" }],
    },
    {
      id: 201,
      name: "給与",
      mode: "income",
      subCategories: [{ id: 2001, name: "給料" }],
    },
  ],
};

const meta = preview.meta({
  title: "Sidebar/Screens/MainScreen",
  component: MainScreen,
  args: {
    serverUrl: MOCK_SERVER_URL,
  },
  decorators: [
    (Story) => (
      <ToastProvider>
        <div className="flex min-h-screen flex-col gap-4 bg-gray-50 p-4">
          <h1 className="text-lg font-bold text-gray-900">Quick Zaim</h1>
          <Story />
          <Toaster />
        </div>
      </ToastProvider>
    ),
  ],
});

export default meta;

const mockStoresResponse = {
  fetchedAt: "2024-01-01T00:00:00Z",
  stores: [
    { place: "スーパーA", placeUid: "uid-001", latestDate: "2024-01-10", count: 5 },
    { place: "コンビニB", placeUid: "uid-002", latestDate: "2024-01-05", count: 3 },
  ],
};

const accountsHandler = http.get(`${MOCK_SERVER_URL}/api/zaim/accounts`, () =>
  HttpResponse.json(mockAccountsResponse),
);

const storesHandler = http.get(`${MOCK_SERVER_URL}/api/zaim/stores`, () =>
  HttpResponse.json(mockStoresResponse),
);

const noDuplicateHandler = http.get(`${MOCK_SERVER_URL}/api/zaim/payment/duplicate`, () =>
  HttpResponse.json({ duplicates: [] }),
);

const categoriesHandler = http.get(`${MOCK_SERVER_URL}/api/zaim/categories`, () =>
  HttpResponse.json(mockCategoriesResponse),
);

const extractPaymentHandler = http.post(`${MOCK_SERVER_URL}/api/llm/extract-payment`, () =>
  HttpResponse.json({
    date: "2026-06-13",
    accountId: 2,
    place: "スーパーA",
    items: [
      { name: "牛乳 1L パック", amount: 250, comment: null, genreId: 1001 },
      { name: "食パン 6枚切り 国産小麦", amount: 198, comment: "朝食用", genreId: 1001 },
      { name: "卵 10個入り 特売", amount: 298, comment: null, genreId: 1001 },
    ],
  }),
);

/**
 * Storybook 上で collectFromActiveTab() が叩く chrome.* API を成功レスポンスでスタブする。
 * preview.ts で globalThis.chrome = fakeBrowser されているため、その上にメソッドを上書きする。
 */
const stubCollectFromActiveTab = () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chromeAny = globalThis.chrome as any;
  chromeAny.tabs.query = async () => [{ id: 1, url: "https://example.com" }];
  chromeAny.scripting = chromeAny.scripting ?? {};
  chromeAny.scripting.executeScript = async () => [];
  chromeAny.tabs.sendMessage = async () => ({
    ok: true,
    url: "https://example.com",
    title: "サンプル商品ページ",
    ariaSnapshot: "",
    collectedAt: new Date().toISOString(),
  });
};

export const Default = meta.story({
  name: "支払いフォーム",
  parameters: {
    msw: {
      handlers: [categoriesHandler, accountsHandler, storesHandler, noDuplicateHandler],
    },
  },
});

export const AllFilled = meta.story({
  name: "全項目入力済み",
  parameters: {
    msw: {
      handlers: [
        categoriesHandler,
        accountsHandler,
        storesHandler,
        noDuplicateHandler,
        extractPaymentHandler,
      ],
    },
  },
  decorators: [
    (Story) => {
      stubCollectFromActiveTab();
      return <Story />;
    },
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = await canvas.findByRole("button", { name: "このページから自動入力" });
    await userEvent.click(button);
    await canvas.findByDisplayValue("250");
  },
});

export const CategoriesLoading = meta.story({
  name: "カテゴリ読み込み中",
  parameters: {
    msw: {
      handlers: [
        http.get(`${MOCK_SERVER_URL}/api/zaim/categories`, async () => {
          await new Promise((resolve) => setTimeout(resolve, 60000));
          return HttpResponse.json(mockCategoriesResponse);
        }),
        accountsHandler,
        storesHandler,
        noDuplicateHandler,
      ],
    },
  },
});

export const CategoriesError = meta.story({
  name: "カテゴリ取得エラー",
  parameters: {
    msw: {
      handlers: [
        http.get(
          `${MOCK_SERVER_URL}/api/zaim/categories`,
          () => new HttpResponse(null, { status: 500 }),
        ),
        accountsHandler,
        storesHandler,
        noDuplicateHandler,
      ],
    },
  },
});
