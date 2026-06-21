import { http, HttpResponse } from "msw";
import { useState } from "react";
import { describe, expect, vi } from "vitest";
import { page } from "vitest/browser";
import { render } from "vitest-browser-react";
import { test } from "../test-utils/browser-test.ts";
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
      name: "銀行口座（無効）",
      active: 0,
      sort: 3,
      modified: "2024-01-01",
      localId: 0,
      websiteId: 0,
      parentAccountId: 0,
    },
  ],
};

const ControlledAccountCombobox = ({ onChange }: { onChange?: (v: number | null) => void }) => {
  const [value, setValue] = useState<number | null>(null);
  return (
    <AccountCombobox
      serverUrl={MOCK_SERVER_URL}
      value={value}
      onChange={(v) => {
        setValue(v);
        onChange?.(v);
      }}
    />
  );
};

describe("AccountCombobox", () => {
  test("ローディング中はスケルトンが表示される", async ({ worker }) => {
    worker.use(
      http.get(`${MOCK_SERVER_URL}/api/zaim/accounts`, async () => {
        await new Promise((resolve) => setTimeout(resolve, 60000));
        return HttpResponse.json(mockAccountsResponse);
      }),
    );

    await render(<ControlledAccountCombobox />);

    await expect.element(page.getByRole("status", { name: "口座を読み込み中" })).toBeVisible();
  });

  test("アクティブな口座のみ表示される", async ({ worker }) => {
    worker.use(
      http.get(`${MOCK_SERVER_URL}/api/zaim/accounts`, () =>
        HttpResponse.json(mockAccountsResponse),
      ),
    );

    await render(<ControlledAccountCombobox />);

    await page.getByRole("combobox", { name: "口座" }).click();

    await expect.element(page.getByRole("option", { name: "現金" })).toBeVisible();
    await expect.element(page.getByRole("option", { name: "クレジットカード" })).toBeVisible();

    // inactive な口座は表示されない
    await expect
      .element(page.getByRole("option", { name: "銀行口座（無効）" }))
      .not.toBeInTheDocument();
  });

  test("口座を選択するとonChangeがidで呼ばれる", async ({ worker }) => {
    worker.use(
      http.get(`${MOCK_SERVER_URL}/api/zaim/accounts`, () =>
        HttpResponse.json(mockAccountsResponse),
      ),
    );

    const onChange = vi.fn<(value: number | null) => void>();
    await render(<ControlledAccountCombobox onChange={onChange} />);

    await page.getByRole("combobox", { name: "口座" }).click();
    await page.getByRole("option", { name: "現金" }).click();

    expect(onChange).toHaveBeenCalledWith(1);
  });

  test("クリアするとonChangeがnullで呼ばれる", async ({ worker }) => {
    worker.use(
      http.get(`${MOCK_SERVER_URL}/api/zaim/accounts`, () =>
        HttpResponse.json(mockAccountsResponse),
      ),
    );

    const onChange = vi.fn<(value: number | null) => void>();
    await render(<ControlledAccountCombobox onChange={onChange} />);

    // まず口座を選択
    await page.getByRole("combobox", { name: "口座" }).click();
    await page.getByRole("option", { name: "現金" }).click();

    // クリアボタンで解除
    await page.getByRole("button", { name: "クリア" }).click();

    expect(onChange).toHaveBeenLastCalledWith(null);
  });

  test("口座取得エラー時にエラーメッセージが表示される", async ({ worker }) => {
    worker.use(
      http.get(
        `${MOCK_SERVER_URL}/api/zaim/accounts`,
        () => new HttpResponse(null, { status: 500 }),
      ),
    );

    await render(<AccountCombobox serverUrl={MOCK_SERVER_URL} value={null} onChange={() => {}} />);

    await expect.element(page.getByText("口座の取得に失敗しました")).toBeVisible();
  });
});
