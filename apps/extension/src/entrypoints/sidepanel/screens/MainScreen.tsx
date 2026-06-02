import { Fragment, useEffect, useState } from "react";
import { Button, Input } from "@cloudflare/kumo";
import { useMutation } from "@tanstack/react-query";
import { AccountCombobox } from "../../../components/AccountCombobox.tsx";
import { CategoryCombobox, type CategorySelection } from "../../../components/CategoryCombobox.tsx";
import { StoreCombobox, type StoreSelection } from "../../../components/StoreCombobox.tsx";
import { createClient } from "server/client";

interface Item {
  id: string;
  name: string;
  amount: string;
  comment: string;
}

interface Props {
  serverUrl: string;
}

type DuplicateInfo = { id: number; date: string; amount: number };
type DuplicateState = "unchecked" | "checking" | "warned";

const newItem = (): Item => ({ id: crypto.randomUUID(), name: "", amount: "", comment: "" });

const localDateString = () => {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

const cellInput =
  "w-full rounded border border-gray-300 bg-white px-2 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";

export default function MainScreen({ serverUrl }: Props) {
  const [items, setItems] = useState<Item[]>([newItem()]);
  const [date, setDate] = useState(localDateString);
  const [categorySelection, setCategorySelection] = useState<CategorySelection | null>(null);
  const [accountId, setAccountId] = useState<number | null>(null);
  const [storeSelection, setStoreSelection] = useState<StoreSelection | null>(null);
  const [duplicateState, setDuplicateState] = useState<DuplicateState>("unchecked");
  const [duplicatesByItemId, setDuplicatesByItemId] = useState<Record<string, DuplicateInfo[]>>({});

  const total = items.reduce((sum, item) => {
    const n = parseInt(item.amount, 10);
    return sum + (Number.isInteger(n) && n > 0 ? n : 0);
  }, 0);

  const updateItem = (id: string, patch: Partial<Omit<Item, "id">>) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  // 入力（カテゴリ・日付・各品目金額）が変わったら重複チェック結果をリセット
  const itemsAmountSignature = items.map((i) => `${i.id}:${i.amount}`).join(",");
  useEffect(() => {
    setDuplicateState("unchecked");
    setDuplicatesByItemId({});
  }, [date, categorySelection?.genreId, itemsAmountSignature]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!categorySelection) return;
      const client = createClient(serverUrl);
      for (const item of items) {
        const res = await client.api.zaim.payment.$post(
          {
            json: {
              category_id: categorySelection.categoryId,
              genre_id: categorySelection.genreId,
              amount: parseInt(item.amount, 10),
              date,
              ...(accountId !== null && { from_account_id: accountId }),
              ...(item.name && { name: item.name }),
              ...(item.comment && { comment: item.comment }),
              ...(storeSelection && {
                place: storeSelection.place,
                place_uid: storeSelection.placeUid,
              }),
            },
          },
          { init: { credentials: "include" } },
        );
        if (!res.ok) throw new Error(`登録に失敗しました（${res.status}）`);
      }
    },
    onSuccess: () => {
      setItems([newItem()]);
      setDate(localDateString());
      setCategorySelection(null);
      setAccountId(null);
      setStoreSelection(null);
      setDuplicateState("unchecked");
      setDuplicatesByItemId({});
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!categorySelection) return;

    if (duplicateState === "warned") {
      mutation.mutate();
      return;
    }

    setDuplicateState("checking");
    const client = createClient(serverUrl);
    const genreId = categorySelection.genreId;

    try {
      const results = await Promise.all(
        items.map(async (item) => {
          const res = await client.api.zaim.payment.duplicate.$get(
            {
              query: {
                date,
                amount: String(parseInt(item.amount, 10)),
                genre_id: String(genreId),
              },
            },
            { init: { credentials: "include" } },
          );
          if (!res.ok) throw new Error(`重複チェックに失敗しました（${res.status}）`);
          const body = (await res.json()) as { duplicates: DuplicateInfo[] };
          return { itemId: item.id, duplicates: body.duplicates };
        }),
      );

      const map = Object.fromEntries(results.map((r) => [r.itemId, r.duplicates]));
      setDuplicatesByItemId(map);
      const hasDup = results.some((r) => r.duplicates.length > 0);
      if (hasDup) {
        setDuplicateState("warned");
      } else {
        setDuplicateState("unchecked");
        mutation.mutate();
      }
    } catch {
      setDuplicateState("unchecked");
      setDuplicatesByItemId({});
    }
  };

  const canSubmit =
    items.length > 0 &&
    items.every((item) => parseInt(item.amount, 10) > 0) &&
    date !== "" &&
    categorySelection !== null &&
    categorySelection.genreId > 0;

  const buttonLabel =
    duplicateState === "checking"
      ? "確認中…"
      : mutation.isPending
        ? "登録中…"
        : duplicateState === "warned"
          ? "重複があっても登録"
          : "登録";

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
      <CategoryCombobox
        serverUrl={serverUrl}
        value={categorySelection}
        onChange={setCategorySelection}
      />
      <AccountCombobox serverUrl={serverUrl} value={accountId} onChange={setAccountId} />
      <StoreCombobox serverUrl={serverUrl} value={storeSelection} onChange={setStoreSelection} />
      <section className="flex flex-col gap-2">
        <div className="grid grid-cols-[1fr_5rem_5rem_1.5rem] items-center gap-x-1 gap-y-1">
          <span className="text-xs font-semibold text-gray-500">品目名</span>
          <span className="text-right text-xs font-semibold text-gray-500">金額</span>
          <span className="text-xs font-semibold text-gray-500">メモ</span>
          <span />

          {items.map((item) => (
            <Fragment key={item.id}>
              <input
                className={cellInput}
                placeholder="品目名"
                value={item.name}
                onChange={(e) => updateItem(item.id, { name: e.target.value })}
              />
              <input
                className={`${cellInput} text-right`}
                type="number"
                min={1}
                step={1}
                placeholder="0"
                value={item.amount}
                onChange={(e) => updateItem(item.id, { amount: e.target.value })}
              />
              <input
                className={cellInput}
                placeholder="メモ"
                value={item.comment}
                onChange={(e) => updateItem(item.id, { comment: e.target.value })}
              />
              <button
                className="flex h-6 w-6 items-center justify-center rounded text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                type="button"
                onClick={() => removeItem(item.id)}
                aria-label="品目を削除"
              >
                ×
              </button>
            </Fragment>
          ))}
        </div>

        <button
          className="self-start text-sm text-blue-600 hover:underline"
          type="button"
          onClick={() => setItems((prev) => [...prev, newItem()])}
        >
          + 品目を追加
        </button>

        <div className="flex items-center justify-between border-t border-gray-200 pt-2">
          <span className="text-sm font-semibold text-gray-700">合計</span>
          <span className="text-lg font-bold text-gray-900">¥{total.toLocaleString("ja-JP")}</span>
        </div>
      </section>

      <Input
        label="日付"
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        required
      />

      {duplicateState === "warned" && (
        <div
          role="alert"
          className="flex flex-col gap-1 rounded-md bg-amber-50 p-2 text-xs text-amber-900"
        >
          <p className="font-medium">直近で同額の支払いが登録されている可能性があります：</p>
          <ul className="ml-4 list-disc">
            {items.flatMap((item) => {
              const dups = duplicatesByItemId[item.id] ?? [];
              if (dups.length === 0) return [];
              const amountNum = parseInt(item.amount, 10);
              return [
                <li key={item.id}>
                  {item.name || "(品目名なし)"} ¥{amountNum.toLocaleString("ja-JP")}（
                  {dups[0]?.date} に登録済み）
                </li>,
              ];
            })}
          </ul>
        </div>
      )}

      <Button
        type="submit"
        variant={duplicateState === "warned" ? "destructive" : "primary"}
        disabled={!canSubmit || mutation.isPending || duplicateState === "checking"}
      >
        {buttonLabel}
      </Button>

      {mutation.isSuccess && (
        <output className="text-sm font-medium text-green-600">登録しました</output>
      )}
      {mutation.isError && (
        <p role="alert" className="text-sm font-medium text-red-600">
          {mutation.error instanceof Error ? mutation.error.message : "登録に失敗しました"}
        </p>
      )}
    </form>
  );
}
