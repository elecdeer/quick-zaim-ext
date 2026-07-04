import { PencilSimpleIcon } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { AccountCombobox } from "../../../components/AccountCombobox.tsx";
import { CategoryCombobox, type CategorySelection } from "../../../components/CategoryCombobox.tsx";
import { DateField } from "../../../components/DateField.tsx";
import { ItemEditDialog, type ItemEditField } from "../../../components/ItemEditDialog.tsx";
import { StoreCombobox, type StoreSelection } from "../../../components/StoreCombobox.tsx";
import { useToastManager } from "@/components/ui/toast";
import { useMutation } from "../../../lib/useMutation.ts";
import { collectFromActiveTab } from "../../../page-collector/collectFromActiveTab.ts";
import { createClient } from "server/client";

interface Item {
  id: string;
  name: string;
  amount: string;
  comment: string;
  category: CategorySelection | null;
}

interface Props {
  serverUrl: string;
}

type DuplicateInfo = { id: number; date: string; amount: number };
type DuplicateState = "unchecked" | "checking" | "warned";

/**
 * categories 一覧から `genreId` が属する `categoryId` を逆引きして
 * `CategorySelection` を組み立てる。該当しなければ null。
 *
 * LLM 推論レスポンスには `genreId` しか含まれないため、registration に必要な
 * `categoryId` をここで補完する。
 */
const findCategorySelectionByGenreId = (
  categories: ReadonlyArray<{ id: number; subCategories: ReadonlyArray<{ id: number }> }>,
  genreId: number,
): CategorySelection | null => {
  for (const category of categories) {
    if (category.subCategories.some((sub) => sub.id === genreId)) {
      return { categoryId: category.id, genreId };
    }
  }
  return null;
};

const newItem = (category: CategorySelection | null = null): Item => ({
  id: crypto.randomUUID(),
  name: "",
  amount: "",
  comment: "",
  category,
});

const localDateString = () => Temporal.Now.plainDateISO().toString();

const isItemReady = (item: Item): boolean =>
  parseInt(item.amount, 10) > 0 && item.category !== null && item.category.genreId > 0;

interface ItemRowProps {
  item: Item;
  serverUrl: string;
  onEdit: (field: ItemEditField) => void;
  onCategoryChange: (category: CategorySelection | null) => void;
  onRemove: () => void;
}

const ItemRow = ({ item, serverUrl, onEdit, onCategoryChange, onRemove }: ItemRowProps) => {
  const amountNum = parseInt(item.amount, 10);
  const amountLabel =
    Number.isInteger(amountNum) && amountNum > 0 ? amountNum.toLocaleString("ja-JP") : "0";

  return (
    <div className="flex flex-col gap-1 rounded-md border bg-card py-2 pl-2 pr-2">
      <div className="flex items-center gap-1">
        <Button
          size="sm"
          variant="ghost"
          type="button"
          className="min-w-0 flex-1 justify-start text-left font-normal"
          onClick={() => onEdit("name")}
          aria-label="品名を編集"
        >
          <span
            className={`min-w-0 truncate text-base ${item.name ? "text-foreground" : "text-muted-foreground"}`}
          >
            {item.name || "品名"}
          </span>
        </Button>
        <Button size="sm" variant="ghost" type="button" onClick={onRemove} aria-label="品目を削除">
          ×
        </Button>
      </div>
      <div className="flex items-center gap-1">
        <Button
          size="sm"
          variant="ghost"
          type="button"
          className="min-w-0 flex-1 justify-start text-left font-normal"
          onClick={() => onEdit("memo")}
          aria-label="メモを編集"
        >
          <PencilSimpleIcon
            size={12}
            className="shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
          <span
            className={`min-w-0 truncate text-[11px] ${item.comment ? "text-foreground" : "text-muted-foreground"}`}
          >
            {item.comment || "メモ"}
          </span>
        </Button>
        <Button
          size="sm"
          variant="ghost"
          type="button"
          className="font-normal tabular-nums"
          onClick={() => onEdit("amount")}
          aria-label="金額を編集"
        >
          <span
            className={`text-base ${item.amount ? "text-foreground" : "text-muted-foreground"}`}
          >
            ¥{amountLabel}
          </span>
        </Button>
      </div>
      <CategoryCombobox
        serverUrl={serverUrl}
        value={item.category}
        onChange={onCategoryChange}
        size="sm"
        label={null}
      />
    </div>
  );
};

export default function MainScreen({ serverUrl }: Props) {
  const toastManager = useToastManager();
  const [items, setItems] = useState<Item[]>([newItem()]);
  const [date, setDate] = useState(localDateString);
  const [accountId, setAccountId] = useState<number | null>(null);
  const [storeSelection, setStoreSelection] = useState<StoreSelection | null>(null);
  const [duplicateState, setDuplicateState] = useState<DuplicateState>("unchecked");
  const [duplicatesByItemId, setDuplicatesByItemId] = useState<Record<string, DuplicateInfo[]>>({});
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editFocus, setEditFocus] = useState<ItemEditField>("name");
  const editingItem = items.find((item) => item.id === editingItemId) ?? null;

  const openItemEditor = (id: string, field: ItemEditField) => {
    setEditFocus(field);
    setEditingItemId(id);
  };

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

  const itemsSignature = items
    .map((i) => `${i.id}:${i.amount}:${i.category?.genreId ?? ""}`)
    .join(",");
  useEffect(() => {
    setDuplicateState("unchecked");
    setDuplicatesByItemId({});
  }, [date, itemsSignature]);

  const extractMutation = useMutation({
    mutationFn: async () => {
      const client = createClient(serverUrl);
      const collected = await collectFromActiveTab();

      const [categoriesRes, accountsRes, storesRes] = await Promise.all([
        client.api.zaim.categories.$get({ query: {} }, { init: { credentials: "include" } }),
        client.api.zaim.accounts.$get({ query: {} }, { init: { credentials: "include" } }),
        client.api.zaim.stores.$get({ query: {} }, { init: { credentials: "include" } }),
      ]);
      if (!categoriesRes.ok)
        throw new Error(`カテゴリの取得に失敗しました（${categoriesRes.status}）`);
      if (!accountsRes.ok) throw new Error(`口座の取得に失敗しました（${accountsRes.status}）`);
      if (!storesRes.ok) throw new Error(`店舗の取得に失敗しました（${storesRes.status}）`);

      const categoriesBody = await categoriesRes.json();
      const accountsBody = await accountsRes.json();
      const storesBody = await storesRes.json();

      const activeAccounts = accountsBody.accounts
        .filter((account) => account.active === 1)
        .map((account) => ({ id: account.id, name: account.name }));

      const extractRes = await client.api.llm["extract-payment"].$post(
        {
          json: {
            pageContent: {
              url: collected.url,
              title: collected.title,
              ariaSnapshot: collected.ariaSnapshot,
              collectedAt: collected.collectedAt,
            },
            categories: categoriesBody.categories,
            accounts: activeAccounts,
            recentStores: storesBody.stores,
          },
        },
        { init: { credentials: "include" } },
      );
      if (!extractRes.ok) {
        throw new Error(`自動入力に失敗しました（${extractRes.status}）`);
      }
      const extracted = await extractRes.json();
      return {
        extracted,
        recentStores: storesBody.stores,
        categories: categoriesBody.categories,
      };
    },
    onSuccess: ({ extracted, recentStores, categories }) => {
      if (extracted.date !== null) setDate(extracted.date);
      if (extracted.accountId !== null) setAccountId(extracted.accountId);
      if (extracted.place !== null) {
        const matched = recentStores.find((s) => s.place === extracted.place);
        setStoreSelection(
          matched
            ? { place: matched.place, placeUid: matched.placeUid }
            : { place: extracted.place, placeUid: "" },
        );
      }
      if (extracted.items.length > 0) {
        setItems(
          extracted.items.map((item) => ({
            id: crypto.randomUUID(),
            name: item.name ?? "",
            amount: item.amount !== null ? String(item.amount) : "",
            comment: item.comment ?? "",
            category:
              item.genreId !== null
                ? findCategorySelectionByGenreId(categories, item.genreId)
                : null,
          })),
        );
      }
    },
  });

  const mutation = useMutation({
    mutationFn: async () => {
      const client = createClient(serverUrl);
      for (const item of items) {
        if (!item.category) throw new Error("カテゴリが選択されていません");
        const res = await client.api.zaim.payment.$post(
          {
            json: {
              category_id: item.category.categoryId,
              genre_id: item.category.genreId,
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
      setAccountId(null);
      setStoreSelection(null);
      setDuplicateState("unchecked");
      setDuplicatesByItemId({});
      toastManager.add({ description: "登録しました" });
    },
  });

  const handleSubmit = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!items.every(isItemReady)) return;

    if (duplicateState === "warned") {
      mutation.mutate();
      return;
    }

    setDuplicateState("checking");
    const client = createClient(serverUrl);

    try {
      const results = await Promise.all(
        items.map(async (item) => {
          if (!item.category) throw new Error("カテゴリが選択されていません");
          const res = await client.api.zaim.payment.duplicate.$get(
            {
              query: {
                date,
                amount: String(parseInt(item.amount, 10)),
                genre_id: String(item.category.genreId),
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

  const canSubmit = items.length > 0 && items.every(isItemReady) && date !== "";

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
      <div className="flex flex-col gap-1">
        <Button
          type="button"
          variant="secondary"
          disabled={extractMutation.isPending || mutation.isPending}
          onClick={() => extractMutation.mutate()}
        >
          {extractMutation.isPending ? "自動入力中…" : "このページから自動入力"}
        </Button>
        {extractMutation.isError && (
          <p role="alert" className="text-sm font-medium text-destructive">
            {extractMutation.error instanceof Error
              ? extractMutation.error.message
              : "自動入力に失敗しました"}
          </p>
        )}
      </div>
      <DateField value={date} onChange={setDate} required />
      <AccountCombobox serverUrl={serverUrl} value={accountId} onChange={setAccountId} />
      <StoreCombobox serverUrl={serverUrl} value={storeSelection} onChange={setStoreSelection} />
      <section className="flex flex-col gap-3">
        {items.map((item) => (
          <ItemRow
            key={item.id}
            item={item}
            serverUrl={serverUrl}
            onEdit={(field) => openItemEditor(item.id, field)}
            onCategoryChange={(category) => updateItem(item.id, { category })}
            onRemove={() => removeItem(item.id)}
          />
        ))}

        <Button
          className="self-start"
          size="sm"
          variant="ghost"
          type="button"
          onClick={() => setItems((prev) => [...prev, newItem(prev.at(-1)?.category ?? null)])}
        >
          + 品目を追加
        </Button>

        <div className="flex items-center justify-between border-t pt-2 pr-2">
          <span className="text-sm font-semibold text-foreground">合計</span>
          <span className="text-lg font-bold text-foreground">
            ¥{total.toLocaleString("ja-JP")}
          </span>
        </div>
      </section>

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
        variant={duplicateState === "warned" ? "destructive" : "default"}
        disabled={!canSubmit || mutation.isPending || duplicateState === "checking"}
      >
        {buttonLabel}
      </Button>

      {mutation.isError && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {mutation.error instanceof Error ? mutation.error.message : "登録に失敗しました"}
        </p>
      )}

      {editingItem && (
        <ItemEditDialog
          open={editingItemId !== null}
          onOpenChange={(open) => {
            if (!open) setEditingItemId(null);
          }}
          serverUrl={serverUrl}
          item={editingItem}
          initialFocus={editFocus}
          onChange={(patch) => updateItem(editingItem.id, patch)}
        />
      )}
    </form>
  );
}
