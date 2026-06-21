import { http, HttpResponse } from "msw";
import { useState } from "react";
import preview from "#storybook/preview";
import { AccountCombobox } from "./AccountCombobox.tsx";

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
    {
      id: 4,
      name: "銀行口座（無効）",
      active: 0,
      sort: 4,
      modified: "2024-01-01",
      localId: 0,
      websiteId: 0,
      parentAccountId: 0,
    },
  ],
};

const ControlledWrapper = ({ serverUrl }: { serverUrl: string }) => {
  const [value, setValue] = useState<number | null>(null);
  return (
    <div className="flex flex-col gap-2">
      <AccountCombobox serverUrl={serverUrl} value={value} onChange={setValue} />
      <p className="text-xs text-gray-500">
        選択中: {value !== null ? `accountId=${value}` : "なし"}
      </p>
    </div>
  );
};

const meta = preview.meta({
  title: "Components/AccountCombobox",
  component: AccountCombobox,
  args: {
    serverUrl: MOCK_SERVER_URL,
    value: null,
    onChange: () => {},
  },
  decorators: [
    () => (
      <div className="p-4">
        <ControlledWrapper serverUrl={MOCK_SERVER_URL} />
      </div>
    ),
  ],
});

export default meta;

export const Default = meta.story({
  name: "口座選択",
  parameters: {
    msw: {
      handlers: [
        http.get(`${MOCK_SERVER_URL}/api/zaim/accounts`, () =>
          HttpResponse.json(mockAccountsResponse),
        ),
      ],
    },
  },
});

export const Loading = meta.story({
  name: "読み込み中",
  parameters: {
    msw: {
      handlers: [
        http.get(`${MOCK_SERVER_URL}/api/zaim/accounts`, async () => {
          await new Promise((resolve) => setTimeout(resolve, 60000));
          return HttpResponse.json(mockAccountsResponse);
        }),
      ],
    },
  },
});

export const Error = meta.story({
  name: "エラー状態",
  parameters: {
    msw: {
      handlers: [
        http.get(
          `${MOCK_SERVER_URL}/api/zaim/accounts`,
          () => new HttpResponse(null, { status: 500 }),
        ),
      ],
    },
  },
});
