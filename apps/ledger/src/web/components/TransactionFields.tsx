/**
 * 取引の入力欄の部品。取引の編集画面とレシートの登録画面で共有する。
 */
import { ArrowDown, ArrowUp, Plus, Trash2, TriangleAlert } from "lucide-react";
import { useId, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import type { CategoryWithGenres } from "@/ledger/masters";
import type { TransactionMode } from "@/ledger/transactions";
import { categoryValueOf } from "@/web/categoryValue";
import { CategoryOptions } from "@/web/components/CategoryOptions";
import { formatAmount } from "@/web/format";
import { emptyItem, moveItem, type ItemDraft } from "@/web/transactionDraft";
import { cn } from "@/lib/utils";

export type AccountOption = { id: number; name: string };

/**
 * 品目の列。広い画面では品目を 1 行に並べ、列の名前は表の見出しに 1 度だけ出す。
 * 支出は並べ替え・削除のボタンの列を持ち、振替・残高調整はカテゴリの列を持たない。
 */
const ITEM_COLUMNS: Record<TransactionMode, string> = {
  payment: "sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)_7rem_5.5rem]",
  income: "sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)_7rem]",
  transfer: "sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_7rem]",
  adjustment: "sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_7rem]",
};

/**
 * ラベル付きの入力欄。labelClassName でラベルを隠す（見出しのある表の中など）こともできる。
 */
export const FormField = ({
  label,
  children,
  htmlFor,
  labelClassName,
}: {
  label: string;
  htmlFor: string;
  children: ReactNode;
  labelClassName?: string;
}) => (
  <div className="flex min-w-0 flex-col gap-0.5">
    <Label
      htmlFor={htmlFor}
      className={cn("text-xs font-normal text-muted-foreground", labelClassName)}
    >
      {label}
    </Label>
    {children}
  </div>
);

/**
 * 口座の選択。選んでいる口座が一覧にない（アーカイブした）ときも、その値を選択肢に残す。
 */
export const AccountSelect = ({
  id,
  value,
  accounts,
  allowEmpty,
  onChange,
}: {
  id: string;
  value: string;
  accounts: AccountOption[];
  allowEmpty: boolean;
  onChange: (value: string) => void;
}) => (
  <NativeSelect
    id={id}
    className="w-full"
    value={value}
    onChange={(event) => onChange(event.target.value)}
  >
    {allowEmpty && <NativeSelectOption value="">なし</NativeSelectOption>}
    {!allowEmpty && value === "" && (
      <NativeSelectOption value="">選んでください</NativeSelectOption>
    )}
    {value !== "" && !accounts.some((account) => String(account.id) === value) && (
      <NativeSelectOption value={value}>一覧にない口座（#{value}）</NativeSelectOption>
    )}
    {accounts.map((account) => (
      <NativeSelectOption key={account.id} value={String(account.id)}>
        {account.name}
      </NativeSelectOption>
    ))}
  </NativeSelect>
);

/**
 * 店舗（取引先）の入力欄。過去の店舗を候補に出しつつ、新しい名前も入れられる。
 */
export const PlaceInput = ({
  id,
  value,
  placeNames,
  onChange,
}: {
  id: string;
  value: string;
  placeNames: string[];
  onChange: (value: string) => void;
}) => {
  const listId = useId();
  return (
    <>
      <Input
        id={id}
        list={listId}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      <datalist id={listId}>
        {placeNames.map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
      </datalist>
    </>
  );
};

/**
 * 入力の誤りや保存の失敗の知らせ。色だけに頼らず、アイコンを添える。
 */
export const ErrorMessage = ({ message }: { message: string }) => (
  <p role="alert" className="flex items-center gap-1.5 text-sm text-destructive">
    <TriangleAlert className="size-4 shrink-0" aria-hidden="true" />
    {message}
  </p>
);

/**
 * 品目 1 件の入力欄。支出と収入ではカテゴリも選ぶ。
 */
const ItemFields = ({
  mode,
  item,
  index,
  count,
  categories,
  onChange,
  onMove,
  onRemove,
}: {
  mode: TransactionMode;
  item: ItemDraft;
  index: number;
  count: number;
  categories: CategoryWithGenres[];
  onChange: (patch: Partial<ItemDraft>) => void;
  onMove: (offset: number) => void;
  onRemove: () => void;
}) => {
  const ids = { category: useId(), name: useId(), memo: useId(), amount: useId() };
  const hasCategory = mode === "payment" || mode === "income";
  const known =
    item.category === "" ||
    categories.some(
      (category) =>
        item.category === categoryValueOf(category.id, null) ||
        category.genres.some((genre) => item.category === categoryValueOf(category.id, genre.id)),
    );

  return (
    <div
      className={cn(
        // 広い画面では入力欄の下線が行の区切りを兼ねるので、行の罫線は狭い画面（欄を積むとき）だけに引く
        "grid grid-cols-2 gap-x-4 gap-y-2 border-b py-3 sm:items-end sm:border-b-0 sm:py-2",
        ITEM_COLUMNS[mode],
      )}
    >
      {hasCategory && (
        <FormField
          label={mode === "payment" ? "内訳" : "カテゴリ"}
          htmlFor={ids.category}
          labelClassName="sm:sr-only"
        >
          <NativeSelect
            id={ids.category}
            className="w-full"
            value={item.category}
            onChange={(event) => onChange({ category: event.target.value })}
          >
            <NativeSelectOption value="">未分類</NativeSelectOption>
            {!known && (
              <NativeSelectOption value={item.category}>一覧にないカテゴリ</NativeSelectOption>
            )}
            {mode === "income" ? (
              // 収入は内訳を持たないので、カテゴリだけを並べる
              categories.map((category) => (
                <NativeSelectOption key={category.id} value={categoryValueOf(category.id, null)}>
                  {category.name}
                </NativeSelectOption>
              ))
            ) : (
              <CategoryOptions label="支出" categories={categories} />
            )}
          </NativeSelect>
        </FormField>
      )}
      <FormField label="品目名" htmlFor={ids.name} labelClassName="sm:sr-only">
        <Input
          id={ids.name}
          value={item.name}
          onChange={(event) => onChange({ name: event.target.value })}
        />
      </FormField>
      <FormField label="メモ" htmlFor={ids.memo} labelClassName="sm:sr-only">
        <Input
          id={ids.memo}
          value={item.memo}
          onChange={(event) => onChange({ memo: event.target.value })}
        />
      </FormField>
      <FormField label="金額" htmlFor={ids.amount} labelClassName="sm:sr-only">
        <Input
          id={ids.amount}
          inputMode="numeric"
          className="text-right tabular-nums"
          value={item.amount}
          onChange={(event) => onChange({ amount: event.target.value })}
        />
      </FormField>
      {mode === "payment" && (
        <div className="col-span-2 flex justify-end gap-0.5 sm:col-span-1">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="上へ"
            disabled={index === 0}
            onClick={() => onMove(-1)}
          >
            <ArrowUp />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="下へ"
            disabled={index === count - 1}
            onClick={() => onMove(1)}
          >
            <ArrowDown />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="品目を消す"
            disabled={count === 1}
            onClick={onRemove}
          >
            <Trash2 />
          </Button>
        </div>
      )}
    </div>
  );
};

/**
 * 品目の表と合計。支出では品目を足す・並べ替える・消すこともできる。
 *
 * `categories` は取引の種類に合うもの（支出なら支出の、収入なら収入のカテゴリ）を渡す。
 */
export const ItemsFields = ({
  mode,
  items,
  categories,
  onChange,
}: {
  mode: TransactionMode;
  items: ItemDraft[];
  categories: CategoryWithGenres[];
  onChange: (items: ItemDraft[]) => void;
}) => {
  const total = items.reduce(
    (sum, item) => sum + (Number(item.amount.replaceAll(",", "")) || 0),
    0,
  );
  const updateItem = (index: number, patch: Partial<ItemDraft>) =>
    onChange(items.map((item, i) => (i === index ? { ...item, ...patch } : item)));

  return (
    <>
      <div
        aria-hidden="true"
        className={cn(
          "hidden gap-x-4 border-b border-foreground pb-1.5 text-xs text-muted-foreground sm:grid",
          ITEM_COLUMNS[mode],
        )}
      >
        {(mode === "payment" || mode === "income") && (
          <span>{mode === "payment" ? "内訳" : "カテゴリ"}</span>
        )}
        <span>品目名</span>
        <span>メモ</span>
        <span className="text-right">金額</span>
      </div>
      {/* 狭い画面では見出しを出さないので、表の始まりの線をここで引く */}
      <div className="border-t border-foreground sm:border-t-0">
        {items.map((item, index) => (
          <ItemFields
            key={item.key}
            mode={mode}
            item={item}
            index={index}
            count={items.length}
            categories={categories}
            onChange={(patch) => updateItem(index, patch)}
            onMove={(offset) => onChange(moveItem(items, index, offset))}
            onRemove={() => onChange(items.filter((_, i) => i !== index))}
          />
        ))}
      </div>
      {mode === "payment" && (
        <Button
          variant="ghost"
          className="mt-1 -ml-2.5 text-muted-foreground"
          onClick={() =>
            onChange([...items, emptyItem(Math.max(-1, ...items.map((item) => item.key)) + 1)])
          }
        >
          <Plus />
          品目を足す
        </Button>
      )}
      <div className="mt-3 flex items-baseline justify-between border-t border-foreground pt-2">
        <span className="text-xs text-muted-foreground">合計</span>
        <span className="text-2xl font-semibold tracking-tight tabular-nums">
          {formatAmount(total)}
        </span>
      </div>
    </>
  );
};
