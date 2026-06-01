import { http, HttpResponse } from "msw";
import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, vi } from "vitest";
import { page } from "vitest/browser";
import { render } from "vitest-browser-react";
import { test } from "../test-utils/browser-test.ts";
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

const ControlledCategoryCombobox = ({
  onChange,
}: {
  onChange?: (v: CategorySelection | null) => void;
}) => {
  const [value, setValue] = useState<CategorySelection | null>(null);
  const [queryClient] = useState(() => new QueryClient());
  return (
    <QueryClientProvider client={queryClient}>
      <CategoryCombobox
        serverUrl={MOCK_SERVER_URL}
        value={value}
        onChange={(v) => {
          setValue(v);
          onChange?.(v);
        }}
      />
    </QueryClientProvider>
  );
};

describe("CategoryCombobox", () => {
  test("ローディング中はスケルトンが表示される", async ({ worker }) => {
    worker.use(
      http.get(`${MOCK_SERVER_URL}/api/zaim/categories`, async () => {
        await new Promise((resolve) => setTimeout(resolve, 60000));
        return HttpResponse.json(mockCategoriesResponse);
      }),
    );

    await render(<ControlledCategoryCombobox />);

    await expect.element(page.getByRole("status", { name: "カテゴリを読み込み中" })).toBeVisible();
  });

  test("paymentモードのカテゴリのみ表示される", async ({ worker }) => {
    worker.use(
      http.get(`${MOCK_SERVER_URL}/api/zaim/categories`, () =>
        HttpResponse.json(mockCategoriesResponse),
      ),
    );

    await render(<ControlledCategoryCombobox />);

    // カテゴリのコンボボックスのトリガーを開く
    await page.getByRole("combobox", { name: "カテゴリ" }).click();

    // paymentモードのカテゴリが表示される
    await expect.element(page.getByRole("option", { name: "食費" })).toBeVisible();
    await expect.element(page.getByRole("option", { name: "交通費" })).toBeVisible();

    // incomeモードのカテゴリは表示されない
    await expect.element(page.getByRole("option", { name: "給与" })).not.toBeInTheDocument();
  });

  test("カテゴリを選択するとサブカテゴリが表示される", async ({ worker }) => {
    worker.use(
      http.get(`${MOCK_SERVER_URL}/api/zaim/categories`, () =>
        HttpResponse.json(mockCategoriesResponse),
      ),
    );

    await render(<ControlledCategoryCombobox />);

    // 初期状態ではサブカテゴリが表示されない
    await expect
      .element(page.getByRole("combobox", { name: "サブカテゴリ" }))
      .not.toBeInTheDocument();

    // カテゴリを選択
    await page.getByRole("combobox", { name: "カテゴリ" }).click();
    await page.getByRole("option", { name: "食費" }).click();

    // サブカテゴリが表示される
    await expect.element(page.getByRole("combobox", { name: "サブカテゴリ" })).toBeVisible();
  });

  test("カテゴリ選択時にonChangeが最初のサブカテゴリIDで呼ばれる", async ({ worker }) => {
    worker.use(
      http.get(`${MOCK_SERVER_URL}/api/zaim/categories`, () =>
        HttpResponse.json(mockCategoriesResponse),
      ),
    );

    const onChange = vi.fn<(value: CategorySelection | null) => void>();
    await render(<ControlledCategoryCombobox onChange={onChange} />);

    await page.getByRole("combobox", { name: "カテゴリ" }).click();
    await page.getByRole("option", { name: "食費" }).click();

    expect(onChange).toHaveBeenCalledWith({ categoryId: 101, genreId: 1001 });
  });

  test("サブカテゴリを選択するとonChangeがgenreIdで呼ばれる", async ({ worker }) => {
    worker.use(
      http.get(`${MOCK_SERVER_URL}/api/zaim/categories`, () =>
        HttpResponse.json(mockCategoriesResponse),
      ),
    );

    const onChange = vi.fn<(value: CategorySelection | null) => void>();
    await render(<ControlledCategoryCombobox onChange={onChange} />);

    // まずカテゴリを選択
    await page.getByRole("combobox", { name: "カテゴリ" }).click();
    await page.getByRole("option", { name: "食費" }).click();

    // 次にサブカテゴリを選択
    await page.getByRole("combobox", { name: "サブカテゴリ" }).click();
    await page.getByRole("option", { name: "外食" }).click();

    expect(onChange).toHaveBeenLastCalledWith({ categoryId: 101, genreId: 1002 });
  });

  test("カテゴリ取得エラー時にエラーメッセージが表示される", async ({ worker }) => {
    worker.use(
      http.get(
        `${MOCK_SERVER_URL}/api/zaim/categories`,
        () => new HttpResponse(null, { status: 500 }),
      ),
    );

    const [queryClient] = [new QueryClient({ defaultOptions: { queries: { retry: false } } })];
    await render(
      <QueryClientProvider client={queryClient}>
        <CategoryCombobox serverUrl={MOCK_SERVER_URL} value={null} onChange={() => {}} />
      </QueryClientProvider>,
    );

    await expect.element(page.getByText("カテゴリの取得に失敗しました")).toBeVisible();
  });
});
