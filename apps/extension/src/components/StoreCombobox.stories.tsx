import { http, HttpResponse } from "msw";
import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import preview from "#storybook/preview";
import { StoreCombobox, type StoreSelection } from "./StoreCombobox.tsx";

const MOCK_SERVER_URL = "http://mock-server.test";

const mockStoresResponse = {
  fetchedAt: "2024-01-01T00:00:00Z",
  stores: [
    { place: "スーパーA", placeUid: "uid-001", latestDate: "2024-01-10", count: 5 },
    { place: "コンビニB", placeUid: "uid-002", latestDate: "2024-01-05", count: 3 },
    { place: "カフェC", placeUid: "uid-003", latestDate: "2024-01-01", count: 1 },
  ],
};

const ControlledWrapper = ({ serverUrl }: { serverUrl: string }) => {
  const [value, setValue] = useState<StoreSelection | null>(null);
  return (
    <div className="flex flex-col gap-2">
      <StoreCombobox serverUrl={serverUrl} value={value} onChange={setValue} />
      <p className="text-xs text-gray-500">
        選択中: {value ? `place="${value.place}", placeUid=${value.placeUid ?? "null"}` : "なし"}
      </p>
    </div>
  );
};

const meta = preview.meta({
  title: "Components/StoreCombobox",
  component: StoreCombobox,
  args: {
    serverUrl: MOCK_SERVER_URL,
    value: null,
    onChange: () => {},
  },
  decorators: [
    () => {
      const [queryClient] = useState(() => new QueryClient());
      return (
        <QueryClientProvider client={queryClient}>
          <div className="p-4">
            <ControlledWrapper serverUrl={MOCK_SERVER_URL} />
          </div>
        </QueryClientProvider>
      );
    },
  ],
});

export default meta;

export const Default = meta.story({
  name: "店舗選択（履歴あり）",
  parameters: {
    msw: {
      handlers: [
        http.get(`${MOCK_SERVER_URL}/api/zaim/stores`, () => HttpResponse.json(mockStoresResponse)),
      ],
    },
  },
});

export const NoHistory = meta.story({
  name: "履歴なし",
  parameters: {
    msw: {
      handlers: [
        http.get(`${MOCK_SERVER_URL}/api/zaim/stores`, () =>
          HttpResponse.json({ fetchedAt: "2024-01-01T00:00:00Z", stores: [] }),
        ),
      ],
    },
  },
});

export const Error = meta.story({
  name: "取得エラー（フリー入力は可能）",
  parameters: {
    msw: {
      handlers: [
        http.get(
          `${MOCK_SERVER_URL}/api/zaim/stores`,
          () => new HttpResponse(null, { status: 500 }),
        ),
      ],
    },
  },
});
