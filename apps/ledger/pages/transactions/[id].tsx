import { action, Link } from "@void/react";
import { Check, Info, Trash2 } from "lucide-react";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
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
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { monthOf } from "@/ledger/dates";
import type { TransactionMode } from "@/ledger/transactions";
import { actionErrorMessage } from "@/web/actionError";
import { Section } from "@/web/components/Section";
import {
  AccountSelect,
  ErrorMessage,
  FormField,
  ItemsFields,
  PlaceInput,
  type AccountOption,
} from "@/web/components/TransactionFields";
import { AGGREGATION_LABELS, MODE_LABELS } from "@/web/labels";
import {
  draftFromTransaction,
  updateFromDraft,
  type TransactionDraft,
} from "@/web/transactionDraft";
import { transactionsHref } from "@/web/transactionsHref";
import type { Props } from "./[id].server";

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
  accounts: AccountOption[];
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
      <DialogTrigger render={<Button variant="ghost" className="text-destructive" />}>
        <Trash2 />
        削除
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>この取引を削除しますか？</DialogTitle>
          <DialogDescription>品目もすべて消え、元に戻せません。</DialogDescription>
        </DialogHeader>
        {error !== null && <ErrorMessage message={error} />}
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
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const ids = { date: useId(), place: useId(), aggregation: useId() };

  const update = (patch: Partial<TransactionDraft>) => {
    setDraft((current) => ({ ...current, ...patch }));
    onSavedChange(false);
  };
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
      className="flex flex-col gap-10"
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <Section label={<h1 className="text-2xl font-semibold">{MODE_LABELS[mode]}</h1>}>
        <div className="grid gap-x-6 gap-y-4 border-t border-foreground pt-3 sm:grid-cols-2">
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
              <PlaceInput
                id={ids.place}
                value={draft.placeName}
                placeNames={placeNames}
                onChange={(placeName) => update({ placeName })}
              />
            </FormField>
          )}
        </div>
      </Section>

      <Section label="品目">
        <ItemsFields
          mode={mode}
          items={draft.items}
          categories={mode === "income" ? categories.income : categories.payment}
          onChange={(items) => update({ items })}
        />
      </Section>

      <Section label="">
        <div className="flex flex-col gap-4">
          {transaction.source === "zaim_csv" && (
            <p className="flex gap-1.5 text-xs text-muted-foreground">
              <Info className="mt-px size-3.5 shrink-0" aria-hidden="true" />
              Zaim
              から取り込んだ取引です。拡張機能を台帳に切り替える前に直すと、切り替えのときの再取り込みで元に戻ります。
            </p>
          )}
          {error !== null && <ErrorMessage message={error} />}
          <div className="flex items-center gap-4">
            <Button type="submit" size="lg" disabled={pending}>
              保存
            </Button>
            {saved && (
              <span className="flex items-center gap-1 text-sm text-muted-foreground">
                <Check className="size-4" aria-hidden="true" />
                保存しました
              </span>
            )}
            <div className="ml-auto">
              <DeleteButton id={transaction.id} />
            </div>
          </div>
        </div>
      </Section>
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
    <div className="flex flex-col gap-6">
      <Link
        href={transactionsHref({ month: monthOf(props.transaction.date) })}
        className="self-start text-xs text-muted-foreground hover:text-foreground"
      >
        ← {Number(props.transaction.date.slice(5, 7))}月の取引
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
