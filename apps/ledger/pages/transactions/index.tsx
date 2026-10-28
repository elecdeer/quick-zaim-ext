import { Link, useRouter } from "@void/react";
import { TriangleAlert, X } from "lucide-react";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import type {
  TransactionFilter,
  TransactionListItem,
  TransactionMode,
} from "@/ledger/transactions";
import { cn } from "@/lib/utils";
import { categoryValueOf, parseCategoryValue } from "@/web/categoryValue";
import { Section } from "@/web/components/Section";
import { CategoryOptions } from "@/web/components/CategoryOptions";
import { MonthHeading } from "@/web/components/MonthHeading";
import { formatAmount, formatDayOfMonth } from "@/web/format";
import { groupByDate } from "@/web/groupByDate";
import { MODE_LABELS } from "@/web/labels";
import { transactionsHref } from "@/web/transactionsHref";
import type { Props } from "./index.server";

const MODES: TransactionMode[] = ["payment", "income", "transfer", "adjustment"];

/**
 * 種類・口座・カテゴリの絞り込み。選ぶとすぐにその条件の一覧へ移る。
 */
const Filters = ({
  filter,
  accounts,
  categories,
  placeName,
}: Pick<Props, "filter" | "accounts" | "categories" | "placeName">) => {
  const router = useRouter();
  const visit = (next: Partial<TransactionFilter>) => {
    void router.visit(transactionsHref({ ...filter, ...next }), { preserveScroll: true });
  };

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
      <NativeSelect
        size="sm"
        aria-label="種類"
        value={filter.mode ?? ""}
        onChange={(event) => {
          const mode = MODES.find((candidate) => candidate === event.target.value);
          visit({ mode });
        }}
      >
        <NativeSelectOption value="">すべての種類</NativeSelectOption>
        {MODES.map((mode) => (
          <NativeSelectOption key={mode} value={mode}>
            {MODE_LABELS[mode]}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      <NativeSelect
        size="sm"
        aria-label="口座"
        value={filter.accountId === undefined ? "" : String(filter.accountId)}
        onChange={(event) =>
          visit({ accountId: event.target.value === "" ? undefined : Number(event.target.value) })
        }
      >
        <NativeSelectOption value="">すべての口座</NativeSelectOption>
        {accounts.map((account) => (
          <NativeSelectOption key={account.id} value={String(account.id)}>
            {account.name}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      <NativeSelect
        size="sm"
        aria-label="カテゴリ"
        value={categoryValueOf(filter.categoryId ?? null, filter.genreId ?? null)}
        onChange={(event) => {
          const { categoryId, genreId } = parseCategoryValue(event.target.value);
          visit({ categoryId: categoryId ?? undefined, genreId: genreId ?? undefined });
        }}
      >
        <NativeSelectOption value="">すべてのカテゴリ</NativeSelectOption>
        <CategoryOptions label="支出" categories={categories.payment} />
        <CategoryOptions label="収入" categories={categories.income} />
      </NativeSelect>
      {filter.placeId !== undefined && (
        <span className="flex h-7 items-center gap-1 border-b border-foreground text-sm">
          {placeName ?? "（削除された店舗）"}
          <button
            type="button"
            aria-label="店舗の絞り込みを外す"
            className="p-0.5 text-muted-foreground hover:text-foreground"
            onClick={() => visit({ placeId: undefined })}
          >
            <X className="size-3.5" />
          </button>
        </span>
      )}
    </div>
  );
};

/**
 * 一覧に出している取引の件数と、支出と収入の合計。
 */
const ListTotals = ({ transactions }: { transactions: TransactionListItem[] }) => {
  const sumOf = (mode: TransactionMode) =>
    transactions
      .filter((transaction) => transaction.mode === mode)
      .reduce((total, transaction) => total + transaction.total, 0);
  return (
    <dl className="flex flex-wrap gap-x-5 text-xs text-muted-foreground">
      <div className="flex gap-1.5">
        <dt>件数</dt>
        <dd className="text-foreground tabular-nums">{transactions.length}</dd>
      </div>
      <div className="flex gap-1.5">
        <dt>支出</dt>
        <dd className="text-foreground tabular-nums">{formatAmount(sumOf("payment"))}</dd>
      </div>
      <div className="flex gap-1.5">
        <dt>収入</dt>
        <dd className="text-foreground tabular-nums">{formatAmount(sumOf("income"))}</dd>
      </div>
    </dl>
  );
};

/**
 * 取引の見出し。店舗、品目名、メモ、内訳、カテゴリの順に最初に見つかったもの。どれもなければ種類の名前にする。
 */
const titleOf = (transaction: TransactionListItem): string => {
  const { items } = transaction;
  return (
    transaction.placeName ??
    items.find((item) => item.name !== null)?.name ??
    items.find((item) => item.memo !== null)?.memo ??
    items.find((item) => item.genreName !== null)?.genreName ??
    items.find((item) => item.categoryName !== null)?.categoryName ??
    MODE_LABELS[transaction.mode]
  );
};

/**
 * 品目の要約。1 件ならその名前、複数なら「最初の品目名 ほか N 件」。
 */
const itemsSummaryOf = (transaction: TransactionListItem): string | null => {
  const [first, ...rest] = transaction.items;
  if (first === undefined) return null;
  const firstName = first.name ?? first.memo;
  if (rest.length === 0) return transaction.placeName === null ? null : firstName;
  return `${firstName ?? "品目"} ほか ${rest.length} 件`;
};

/**
 * 取引の口座。振替は「元 → 先」にする。
 */
const accountsOf = (transaction: TransactionListItem): string | null => {
  const { fromAccountName, toAccountName } = transaction;
  if (fromAccountName !== null && toAccountName !== null) {
    return `${fromAccountName} → ${toAccountName}`;
  }
  return fromAccountName ?? toAccountName;
};

/**
 * 取引の品目のカテゴリ（内訳）を重複なく並べる。
 */
const categoriesOf = (transaction: TransactionListItem): string[] => [
  ...new Set(
    transaction.items
      .filter((item) => item.categoryName !== null || item.genreName !== null)
      .map((item) => item.genreName ?? item.categoryName ?? ""),
  ),
];

/**
 * 金額の書き方。収入には「+」を付けてお金の向きを示す。
 */
const amountOf = (transaction: TransactionListItem): string =>
  transaction.mode === "income"
    ? `+${formatAmount(transaction.total)}`
    : formatAmount(transaction.total);

/**
 * 取引 1 件の行。押すと編集画面へ移る。
 *
 * 振替と残高調整はお金の出入りではないので、行全体を薄くして支出・収入と見分ける。
 */
const TransactionRow = ({ transaction }: { transaction: TransactionListItem }) => {
  const summary = itemsSummaryOf(transaction);
  const accountName = accountsOf(transaction);
  const details = [summary, ...categoriesOf(transaction)].filter((value) => value !== null);
  const isMove = transaction.mode === "transfer" || transaction.mode === "adjustment";
  return (
    <li className="border-b">
      <Link
        href={`/transactions/${transaction.id}`}
        className={cn(
          "grid grid-cols-[minmax(0,1fr)_6rem] items-baseline gap-x-4 py-2.5 hover:bg-muted/60 sm:grid-cols-[minmax(0,1fr)_9rem_6rem]",
          isMove && "text-muted-foreground",
        )}
      >
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate">
            {transaction.mode !== "payment" && (
              <span className="mr-2 text-xs text-muted-foreground">
                {MODE_LABELS[transaction.mode]}
              </span>
            )}
            {titleOf(transaction)}
          </span>
          {(details.length > 0 || accountName !== null) && (
            <span className="truncate text-xs text-muted-foreground">
              {details.join("・")}
              {/* 狭い画面では口座の列を出さないので、ここに続けて書く */}
              {accountName !== null && (
                <span className="sm:hidden">
                  {details.length > 0 && "・"}
                  {accountName}
                </span>
              )}
            </span>
          )}
          {transaction.aggregation !== "always" && (
            <span className="flex items-center gap-1 text-xs text-destructive">
              <TriangleAlert className="size-3.5" aria-hidden="true" />
              {transaction.aggregation === "never" ? "集計に含めない" : "年の集計にのみ含める"}
            </span>
          )}
        </span>
        <span className="hidden truncate text-xs text-muted-foreground sm:block">
          {accountName}
        </span>
        <span className="text-right tabular-nums">{amountOf(transaction)}</span>
      </Link>
    </li>
  );
};

/**
 * 取引の一覧の画面。日付ごとにまとめ、日付を左の列に出す。
 */
const TransactionsPage = ({ filter, transactions, accounts, categories, placeName }: Props) => (
  <div className="flex flex-col gap-8">
    <div className="grid gap-x-4 gap-y-6 md:grid-cols-12 md:items-end">
      <div className="md:col-span-3">
        <MonthHeading
          month={filter.month}
          hrefOf={(month) => transactionsHref({ ...filter, month })}
        />
      </div>
      <div className="flex flex-col gap-3 md:col-span-9">
        <Filters
          filter={filter}
          accounts={accounts}
          categories={categories}
          placeName={placeName}
        />
        <ListTotals transactions={transactions} />
      </div>
    </div>
    {transactions.length === 0 ? (
      <Section label="">
        <p className="border-t border-foreground py-2.5 text-sm text-muted-foreground">
          条件に合う取引はありません
        </p>
      </Section>
    ) : (
      <div>
        {groupByDate(transactions).map((group, index) => (
          <Section
            key={group.date}
            className="gap-y-0"
            label={
              <span className="block pt-2.5 text-xs font-normal text-muted-foreground tabular-nums">
                {formatDayOfMonth(group.date)}
              </span>
            }
          >
            {/* 一覧の始まりにだけ黒の線を引く */}
            <ul className={cn(index === 0 && "border-t border-foreground")}>
              {group.items.map((transaction) => (
                <TransactionRow key={transaction.id} transaction={transaction} />
              ))}
            </ul>
          </Section>
        ))}
      </div>
    )}
  </div>
);

export default TransactionsPage;
