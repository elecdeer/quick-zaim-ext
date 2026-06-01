import { http, HttpResponse } from "msw";
import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import preview from "#storybook/preview";
import { CategoryCombobox, type CategorySelection } from "./CategoryCombobox.tsx";

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
    {
      id: 201,
      name: "給与",
      mode: "income",
      subCategories: [{ id: 2001, name: "給料" }],
    },
  ],
};

const ControlledWrapper = ({ serverUrl }: { serverUrl: string }) => {
  const [value, setValue] = useState<CategorySelection | null>(null);
  return (
    <div className="flex flex-col gap-2">
      <CategoryCombobox serverUrl={serverUrl} value={value} onChange={setValue} />
      <p className="text-xs text-gray-500">
        選択中: {value ? `categoryId=${value.categoryId}, genreId=${value.genreId}` : "なし"}
      </p>
    </div>
  );
};

const meta = preview.meta({
  title: "Components/CategoryCombobox",
  component: CategoryCombobox,
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
  name: "カテゴリ選択",
  parameters: {
    msw: {
      handlers: [
        http.get(`${MOCK_SERVER_URL}/api/zaim/categories`, () =>
          HttpResponse.json(mockCategoriesResponse),
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
        http.get(`${MOCK_SERVER_URL}/api/zaim/categories`, async () => {
          await new Promise((resolve) => setTimeout(resolve, 60000));
          return HttpResponse.json(mockCategoriesResponse);
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
          `${MOCK_SERVER_URL}/api/zaim/categories`,
          () => new HttpResponse(null, { status: 500 }),
        ),
      ],
    },
  },
});
