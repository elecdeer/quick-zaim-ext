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
  test("ラベルと入力フィールドが表示される", async ({ worker }) => {
    worker.use(
      http.get(`${MOCK_SERVER_URL}/api/zaim/stores`, () => HttpResponse.json(mockStoresResponse)),
    );

    await render(<ControlledStoreCombobox />);

    // list属性付きinputのARIAロールはcombobox
    await expect.element(page.getByRole("combobox", { name: "店舗" })).toBeVisible();
    await expect.element(page.getByText("店舗")).toBeVisible();
  });

  test("過去履歴がdatalistに表示される", async ({ worker }) => {
    worker.use(
      http.get(`${MOCK_SERVER_URL}/api/zaim/stores`, () => HttpResponse.json(mockStoresResponse)),
    );

    await render(<ControlledStoreCombobox />);

    // データ取得後 datalist にオプションが追加されるのを待つ
    await vi.waitFor(() => {
      const options = Array.from(document.querySelectorAll("datalist option"));
      const values = options.map((o) => o.getAttribute("value"));
      expect(values).toContain("スーパーA");
      expect(values).toContain("コンビニB");
      expect(values).toContain("カフェC");
    });
  });

  test("既知の店舗名を入力するとplaceUid付きでonChangeが呼ばれる", async ({ worker }) => {
    worker.use(
      http.get(`${MOCK_SERVER_URL}/api/zaim/stores`, () => HttpResponse.json(mockStoresResponse)),
    );

    const onChange = vi.fn<(value: StoreSelection | null) => void>();
    await render(<ControlledStoreCombobox onChange={onChange} />);

    await page.getByRole("combobox", { name: "店舗" }).fill("スーパーA");

    expect(onChange).toHaveBeenCalledWith({ place: "スーパーA", placeUid: "uid-001" });
  });

  test("未知の店舗名（フリー入力）はplaceUidがnullでonChangeが呼ばれる", async ({ worker }) => {
    worker.use(
      http.get(`${MOCK_SERVER_URL}/api/zaim/stores`, () => HttpResponse.json(mockStoresResponse)),
    );

    const onChange = vi.fn<(value: StoreSelection | null) => void>();
    await render(<ControlledStoreCombobox onChange={onChange} />);

    await page.getByRole("combobox", { name: "店舗" }).fill("新しいお店");

    expect(onChange).toHaveBeenCalledWith({ place: "新しいお店", placeUid: null });
  });

  test("入力をクリアするとonChangeがnullで呼ばれる", async ({ worker }) => {
    worker.use(
      http.get(`${MOCK_SERVER_URL}/api/zaim/stores`, () => HttpResponse.json(mockStoresResponse)),
    );

    const onChange = vi.fn<(value: StoreSelection | null) => void>();
    await render(<ControlledStoreCombobox onChange={onChange} />);

    const input = page.getByRole("combobox", { name: "店舗" });
    await input.fill("スーパーA");
    await input.clear();

    expect(onChange).toHaveBeenLastCalledWith(null);
  });

  test("店舗取得失敗時もフリー入力は機能する", async ({ worker }) => {
    worker.use(
      http.get(`${MOCK_SERVER_URL}/api/zaim/stores`, () => new HttpResponse(null, { status: 500 })),
    );

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const onChange = vi.fn<(value: StoreSelection | null) => void>();

    await render(
      <QueryClientProvider client={queryClient}>
        <StoreCombobox serverUrl={MOCK_SERVER_URL} value={null} onChange={onChange} />
      </QueryClientProvider>,
    );

    await page.getByRole("combobox", { name: "店舗" }).fill("手打ちの店");

    expect(onChange).toHaveBeenCalledWith({ place: "手打ちの店", placeUid: null });
  });
});
