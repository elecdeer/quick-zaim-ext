import { http, HttpResponse } from "msw";
import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, vi } from "vitest";
import { page } from "vitest/browser";
import { render } from "vitest-browser-react";
import { test } from "../test-utils/browser-test.ts";
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

const ControlledStoreCombobox = ({
  onChange,
}: {
  onChange?: (v: StoreSelection | null) => void;
}) => {
  const [value, setValue] = useState<StoreSelection | null>(null);
  const [queryClient] = useState(() => new QueryClient());
  return (
    <QueryClientProvider client={queryClient}>
      <StoreCombobox
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

describe("StoreCombobox", () => {
  test("ローディング中はスケルトンが表示される", async ({ worker }) => {
    worker.use(
      http.get(`${MOCK_SERVER_URL}/api/zaim/stores`, async () => {
        await new Promise((resolve) => setTimeout(resolve, 60000));
        return HttpResponse.json(mockStoresResponse);
      }),
    );

    await render(<ControlledStoreCombobox />);

    await expect.element(page.getByRole("status", { name: "店舗を読み込み中" })).toBeVisible();
  });

  test("過去の店舗一覧が表示される", async ({ worker }) => {
    worker.use(
      http.get(`${MOCK_SERVER_URL}/api/zaim/stores`, () => HttpResponse.json(mockStoresResponse)),
    );

    await render(<ControlledStoreCombobox />);

    await page.getByRole("combobox", { name: "店舗" }).click();

    await expect.element(page.getByRole("option", { name: "スーパーA" })).toBeVisible();
    await expect.element(page.getByRole("option", { name: "コンビニB" })).toBeVisible();
    await expect.element(page.getByRole("option", { name: "カフェC" })).toBeVisible();
  });

  test("店舗を選択するとplace・placeUid付きでonChangeが呼ばれる", async ({ worker }) => {
    worker.use(
      http.get(`${MOCK_SERVER_URL}/api/zaim/stores`, () => HttpResponse.json(mockStoresResponse)),
    );

    const onChange = vi.fn<(value: StoreSelection | null) => void>();
    await render(<ControlledStoreCombobox onChange={onChange} />);

    await page.getByRole("combobox", { name: "店舗" }).click();
    await page.getByRole("option", { name: "スーパーA" }).click();

    expect(onChange).toHaveBeenCalledWith({ place: "スーパーA", placeUid: "uid-001" });
  });

  test("クリアするとonChangeがnullで呼ばれる", async ({ worker }) => {
    worker.use(
      http.get(`${MOCK_SERVER_URL}/api/zaim/stores`, () => HttpResponse.json(mockStoresResponse)),
    );

    const onChange = vi.fn<(value: StoreSelection | null) => void>();
    await render(<ControlledStoreCombobox onChange={onChange} />);

    await page.getByRole("combobox", { name: "店舗" }).click();
    await page.getByRole("option", { name: "スーパーA" }).click();

    await page.getByRole("button", { name: "クリア" }).click();

    expect(onChange).toHaveBeenLastCalledWith(null);
  });

  test("店舗取得エラー時にエラーメッセージが表示される", async ({ worker }) => {
    worker.use(
      http.get(`${MOCK_SERVER_URL}/api/zaim/stores`, () => new HttpResponse(null, { status: 500 })),
    );

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    await render(
      <QueryClientProvider client={queryClient}>
        <StoreCombobox serverUrl={MOCK_SERVER_URL} value={null} onChange={() => {}} />
      </QueryClientProvider>,
    );

    await expect.element(page.getByText("店舗の取得に失敗しました")).toBeVisible();
  });
});
