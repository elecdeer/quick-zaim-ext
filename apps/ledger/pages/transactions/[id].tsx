import { action, Link } from "@void/react";
import { ArrowDown, ArrowLeft, ArrowUp, Plus, Trash2 } from "lucide-react";
import { useId, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { monthOf } from "@/ledger/dates";
import type { TransactionMode } from "@/ledger/transactions";
import { actionErrorMessage } from "@/web/actionError";
import { categoryValueOf } from "@/web/categoryValue";
import { CategoryOptions } from "@/web/components/CategoryOptions";
import { formatYen } from "@/web/format";
import { AGGREGATION_LABELS, MODE_LABELS } from "@/web/labels";
import {
  draftFromTransaction,
  emptyItem,
  moveItem,
  updateFromDraft,
  type ItemDraft,
  type TransactionDraft,
} from "@/web/transactionDraft";
import { transactionsHref } from "@/web/transactionsHref";
import type { Props } from "./[id].server";

type Accounts = Props["accounts"];

/**
 * ラベル付きの入力欄。
 */
const FormField = ({
  label,
  children,
  htmlFor,
}: {
  label: string;
  htmlFor: string;
  children: ReactNode;
}) => (
  <div className="flex flex-col gap-1.5">
    <Label htmlFor={htmlFor}>{label}</Label>
    {children}
  </div>
);

/**
 * 口座の選択。選んでいる口座が一覧にない（アーカイブした）ときも、その値を選択肢に残す。
 */
const AccountSelect = ({
  id,
  value,
  accounts,
  allowEmpty,
  onChange,
}: {
  id: string;
  value: string;
  accounts: Accounts;
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
 * 種類ごとの口座の入力欄。
 *
 * 残高調整は「増やす / 減らす」と口座で入れ、増やすなら入金先、減らすなら支払元に入れる。
 */
const AccountFields = ({
  mode,
  draft,
  accounts,
  update,
}: {
  mode: TransactionMode;
  draft: TransactionDraft;
  accounts: Accounts;
  update: (patch: Partial<TransactionDraft>) => void;
}) => {
  const fromId = useId();
  const toId = useId();
  const directionId = useId();

  if (mode === "adjustment") {
    const increases = draft.toAccountId !== "";
    const accountId = increases ? draft.toAccountId : draft.fromAccountId;
    const setAdjustment = (nextIncreases: boolean, nextAccountId: string) =>
      update(
        nextIncreases
          ? { toAccountId: nextAccountId, fromAccountId: "" }
          : { fromAccountId: nextAccountId, toAccountId: "" },
      );
    return (
      <>
        <FormField label="向き" htmlFor={directionId}>
          <NativeSelect
            id={directionId}
            className="w-full"
            value={increases ? "increase" : "decrease"}
            onChange={(event) => setAdjustment(event.target.value === "increase", accountId)}
          >
            <NativeSelectOption value="increase">残高を増やす</NativeSelectOption>
            <NativeSelectOption value="decrease">残高を減らす</NativeSelectOption>
          </NativeSelect>
        </FormField>
        <FormField label="口座" htmlFor={fromId}>
          <AccountSelect
            id={fromId}
            value={accountId}
            accounts={accounts}
            allowEmpty={false}
            onChange={(value) => setAdjustment(increases, value)}
          />
        </FormField>
      </>
    );
  }

  return (
    <>
      {(mode === "payment" || mode === "transfer") && (
        <FormField label="支払元" htmlFor={fromId}>
          <AccountSelect
            id={fromId}
            value={draft.fromAccountId}
            accounts={accounts}
            allowEmpty={mode === "payment"}
            onChange={(value) => update({ fromAccountId: value })}
          />
        </FormField>
      )}
      {(mode === "income" || mode === "transfer") && (
        <FormField label="入金先" htmlFor={toId}>
          <AccountSelect
            id={toId}
            value={draft.toAccountId}
            accounts={accounts}
            allowEmpty={mode === "income"}
            onChange={(value) => update({ toAccountId: value })}
          />
        </FormField>
      )}
    </>
  );
};

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
  categories: Props["categories"];
  onChange: (patch: Partial<ItemDraft>) => void;
  onMove: (offset: number) => void;
  onRemove: () => void;
}) => {
  const ids = { category: useId(), name: useId(), memo: useId(), amount: useId() };
  const hasCategory = mode === "payment" || mode === "income";
  const options = mode === "income" ? categories.income : categories.payment;
  const known =
    item.category === "" ||
    options.some(
      (category) =>
        item.category === categoryValueOf(category.id, null) ||
        category.genres.some((genre) => item.category === categoryValueOf(category.id, genre.id)),
    );

  return (
    <div className="grid gap-3 rounded-lg border p-3 sm:grid-cols-2">
      {hasCategory && (
        <FormField label={mode === "payment" ? "内訳" : "カテゴリ"} htmlFor={ids.category}>
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
              options.map((category) => (
                <NativeSelectOption key={category.id} value={categoryValueOf(category.id, null)}>
                  {category.name}
                </NativeSelectOption>
              ))
            ) : (
              <CategoryOptions label="支出" categories={options} />
            )}
          </NativeSelect>
        </FormField>
      )}
      <FormField label="金額" htmlFor={ids.amount}>
        <Input
          id={ids.amount}
          inputMode="numeric"
          className="text-right tabular-nums"
          value={item.amount}
          onChange={(event) => onChange({ amount: event.target.value })}
        />
      </FormField>
      <FormField label="品目名" htmlFor={ids.name}>
        <Input
          id={ids.name}
          value={item.name}
          onChange={(event) => onChange({ name: event.target.value })}
        />
      </FormField>
      <FormField label="メモ" htmlFor={ids.memo}>
        <Input
          id={ids.memo}
          value={item.memo}
          onChange={(event) => onChange({ memo: event.target.value })}
        />
      </FormField>
      {mode === "payment" && (
        <div className="flex justify-end gap-1 sm:col-span-2">
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
 * 取引を消す確認のダイアログ。
 */
const DeleteButton = ({ id }: { id: number }) => {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const remove = async () => {
    setPending(true);
    const result = await action("/transactions/:id?delete", {
      params: { id: String(id) },
      method: "POST",
    });
    setPending(false);
    if (!result.ok) setError(actionErrorMessage(result.error));
  };

  return (
    <Dialog>
      <DialogTrigger render={<Button variant="destructive" />}>
        <Trash2 />
        削除
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>この取引を削除しますか？</DialogTitle>
          <DialogDescription>品目もすべて消え、元に戻せません。</DialogDescription>
        </DialogHeader>
        {error !== null && <p className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>やめる</DialogClose>
          <Button variant="destructive" disabled={pending} onClick={() => void remove()}>
            削除する
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

/**
 * 取引の編集フォーム。保存すると loader が走り直し、親が key を変えてこのフォームを作り直す。
 * 作り直しても「保存しました」を出し続けられるよう、保存したかどうかは親が持つ。
 */
const EditForm = ({
  transaction,
  accounts,
  categories,
  placeNames,
  saved,
  onSavedChange,
}: Props & { saved: boolean; onSavedChange: (saved: boolean) => void }) => {
  const { mode } = transaction;
  const [draft, setDraft] = useState(() => draftFromTransaction(transaction));
  const [nextKey, setNextKey] = useState(transaction.items.length);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const ids = { date: useId(), place: useId(), placeList: useId(), aggregation: useId() };

  const update = (patch: Partial<TransactionDraft>) => {
    setDraft((current) => ({ ...current, ...patch }));
    onSavedChange(false);
  };
  const updateItem = (index: number, patch: Partial<ItemDraft>) =>
    update({
      items: draft.items.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    });

  const total = draft.items.reduce(
    (sum, item) => sum + (Number(item.amount.replaceAll(",", "")) || 0),
    0,
  );

  const save = async () => {
    const parsed = updateFromDraft(draft);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    setError(null);
    setPending(true);
    const result = await action("/transactions/:id?update", {
      params: { id: String(transaction.id) },
      data: parsed.input,
    });
    setPending(false);
    if (result.ok) onSavedChange(true);
    else setError(actionErrorMessage(result.error));
  };

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <Card>
        <CardHeader>
          <CardTitle>{MODE_LABELS[mode]}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <FormField label="日付" htmlFor={ids.date}>
            <Input
              id={ids.date}
              type="date"
              required
              value={draft.date}
              onChange={(event) => update({ date: event.target.value })}
            />
          </FormField>
          <FormField label="集計の設定" htmlFor={ids.aggregation}>
            <NativeSelect
              id={ids.aggregation}
              className="w-full"
              value={draft.aggregation}
              onChange={(event) => {
                const aggregation = (["always", "never", "yearly_only"] as const).find(
                  (value) => value === event.target.value,
                );
                if (aggregation !== undefined) update({ aggregation });
              }}
            >
              {(["always", "never", "yearly_only"] as const).map((value) => (
                <NativeSelectOption key={value} value={value}>
                  {AGGREGATION_LABELS[value]}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </FormField>
          <AccountFields mode={mode} draft={draft} accounts={accounts} update={update} />
          {(mode === "payment" || mode === "income") && (
            <FormField label={mode === "payment" ? "店舗" : "取引先"} htmlFor={ids.place}>
              <Input
                id={ids.place}
                list={ids.placeList}
                value={draft.placeName}
                onChange={(event) => update({ placeName: event.target.value })}
              />
              <datalist id={ids.placeList}>
                {placeNames.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </datalist>
            </FormField>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-baseline justify-between">
            <span>品目</span>
            <span className="tabular-nums">{formatYen(total)}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {draft.items.map((item, index) => (
            <ItemFields
              key={item.key}
              mode={mode}
              item={item}
              index={index}
              count={draft.items.length}
              categories={categories}
              onChange={(patch) => updateItem(index, patch)}
              onMove={(offset) => update({ items: moveItem(draft.items, index, offset) })}
              onRemove={() => update({ items: draft.items.filter((_, i) => i !== index) })}
            />
          ))}
          {mode === "payment" && (
            <Button
              variant="outline"
              className="self-start"
              onClick={() => {
                update({ items: [...draft.items, emptyItem(nextKey)] });
                setNextKey(nextKey + 1);
              }}
            >
              <Plus />
              品目を足す
            </Button>
          )}
        </CardContent>
      </Card>

      {transaction.source === "zaim_csv" && (
        <p className="text-xs text-muted-foreground">
          Zaim
          から取り込んだ取引です。拡張機能を台帳に切り替える前に直すと、切り替えのときの再取り込みで元に戻ります。
        </p>
      )}
      {error !== null && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          保存
        </Button>
        {saved && <span className="text-sm text-muted-foreground">保存しました</span>}
        <div className="ml-auto">
          <DeleteButton id={transaction.id} />
        </div>
      </div>
    </form>
  );
};

/**
 * 取引の編集の画面。
 */
const TransactionEditPage = (props: Props) => {
  // 別の取引の画面へ移っても「保存しました」が残らないよう、保存した取引の ID で持つ
  const [savedId, setSavedId] = useState<number | null>(null);
  return (
    <div className="flex flex-col gap-4">
      <Link
        href={transactionsHref({ month: monthOf(props.transaction.date) })}
        className="flex items-center gap-1 self-start text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        取引の一覧へ
      </Link>
      {/* 保存すると loader の値が変わるので、key を変えて入力中の値を保存した内容で作り直す */}
      <EditForm
        key={JSON.stringify(props.transaction)}
        {...props}
        saved={savedId === props.transaction.id}
        onSavedChange={(saved) => setSavedId(saved ? props.transaction.id : null)}
      />
    </div>
  );
};

export default TransactionEditPage;
