import { Link, useRouter } from "@void/react";
import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  NativeSelect,
  NativeSelectOptGroup,
  NativeSelectOption,
} from "@/components/ui/native-select";
import type { CategoryWithGenres } from "@/ledger/masters";
import type {
  TransactionFilter,
  TransactionListItem,
  TransactionMode,
} from "@/ledger/transactions";
import { cn } from "@/lib/utils";
import { MonthNavigation } from "@/web/components/MonthNavigation";
import { formatDay, formatYen } from "@/web/format";
import { MODE_LABELS } from "@/web/labels";
import { transactionsHref } from "@/web/transactionsHref";
import type { Props } from "./index.server";

const MODES: TransactionMode[] = ["payment", "income", "transfer", "adjustment"];

/**
 * カテゴリ・内訳の選択肢の値。カテゴリは `c:ID`、内訳は `g:カテゴリID:ID` にして 1 つの選択で両方を選べるようにする。
 */
const categoryValue = (filter: TransactionFilter): string => {
  if (filter.genreId !== undefined) return `g:${filter.categoryId ?? ""}:${filter.genreId}`;
  if (filter.categoryId !== undefined) return `c:${filter.categoryId}`;
  return "";
};

/**
 * カテゴリ・内訳の選択肢の値を、絞り込みの条件に戻す。
 */
const parseCategoryValue = (value: string): Pick<TransactionFilter, "categoryId" | "genreId"> => {
  const [kind, first, second] = value.split(":");
  if (kind === "c") return { categoryId: Number(first), genreId: undefined };
  if (kind === "g") {
    return { categoryId: first ? Number(first) : undefined, genreId: Number(second) };
  }
  return { categoryId: undefined, genreId: undefined };
};

/**
 * カテゴリと内訳の選択肢。
 */
const CategoryOptions = ({
  label,
  categories,
}: {
  label: string;
  categories: CategoryWithGenres[];
}) => (
  <NativeSelectOptGroup label={label}>
    {categories.map((category) => [
      <NativeSelectOption key={`c${category.id}`} value={`c:${category.id}`}>
        {category.name}
      </NativeSelectOption>,
      ...category.genres.map((genre) => (
        <NativeSelectOption key={`g${genre.id}`} value={`g:${category.id}:${genre.id}`}>
          {`　${genre.name}`}
        </NativeSelectOption>
      )),
    ])}
  </NativeSelectOptGroup>
);

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
    <div className="flex flex-wrap items-center gap-2">
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
        value={categoryValue(filter)}
        onChange={(event) => visit(parseCategoryValue(event.target.value))}
      >
        <NativeSelectOption value="">すべてのカテゴリ</NativeSelectOption>
        <CategoryOptions label="支出" categories={categories.payment} />
        <CategoryOptions label="収入" categories={categories.income} />
      </NativeSelect>
      {filter.placeId !== undefined && (
        <Badge variant="secondary" className="h-7 gap-1 pr-1">
          {placeName ?? "（削除された店舗）"}
          <button
            type="button"
            aria-label="店舗の絞り込みを外す"
            className="rounded-full p-0.5 hover:bg-muted-foreground/20"
            onClick={() => visit({ placeId: undefined })}
          >
            <X />
          </button>
        </Badge>
      )}
    </div>
  );
};

/**
 * 一覧に出している取引の、支出と収入の合計。
 */
const ListTotals = ({ transactions }: { transactions: TransactionListItem[] }) => {
  const sumOf = (mode: TransactionMode) =>
    transactions
      .filter((transaction) => transaction.mode === mode)
      .reduce((total, transaction) => total + transaction.total, 0);
  return (
    <p className="flex gap-4 text-sm text-muted-foreground">
      <span>{transactions.length} 件</span>
      <span>
        支出{" "}
        <span className="font-medium text-foreground tabular-nums">
          {formatYen(sumOf("payment"))}
        </span>
      </span>
      <span>
        収入{" "}
        <span className="font-medium text-foreground tabular-nums">
          {formatYen(sumOf("income"))}
        </span>
      </span>
    </p>
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
 * 取引 1 件の行。押すと編集画面へ移る。
 */
const TransactionRow = ({ transaction }: { transaction: TransactionListItem }) => {
  const summary = itemsSummaryOf(transaction);
  const accountName = accountsOf(transaction);
  const categoryNames = categoriesOf(transaction);
  return (
    <li className="border-b last:border-b-0">
      <Link
        href={`/transactions/${transaction.id}`}
        className="flex items-start gap-3 px-2 py-3 hover:bg-muted/50"
      >
        <span className="w-16 shrink-0 pt-0.5 text-xs text-muted-foreground tabular-nums">
          {formatDay(transaction.date)}
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="flex items-center gap-2">
            {transaction.mode !== "payment" && (
              <Badge variant="outline">{MODE_LABELS[transaction.mode]}</Badge>
            )}
            <span className="truncate font-medium">{titleOf(transaction)}</span>
          </span>
          {summary !== null && (
            <span className="truncate text-sm text-muted-foreground">{summary}</span>
          )}
          <span className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
            {categoryNames.length > 0 && <span>{categoryNames.join("・")}</span>}
            {accountName !== null && <span>{accountName}</span>}
            {transaction.aggregation !== "always" && (
              <span className="text-amber-700 dark:text-amber-400">
                {transaction.aggregation === "never" ? "集計に含めない" : "年の集計のみ"}
              </span>
            )}
          </span>
        </span>
        <span
          className={cn(
            "shrink-0 font-medium tabular-nums",
            transaction.mode === "income" && "text-emerald-700 dark:text-emerald-400",
            transaction.mode !== "payment" &&
              transaction.mode !== "income" &&
              "text-muted-foreground",
          )}
        >
          {formatYen(transaction.total)}
        </span>
      </Link>
    </li>
  );
};

/**
 * 取引の一覧の画面。
 */
const TransactionsPage = ({ filter, transactions, accounts, categories, placeName }: Props) => (
  <div className="flex flex-col gap-4">
    <MonthNavigation
      month={filter.month}
      hrefOf={(month) => transactionsHref({ ...filter, month })}
    />
    <Filters filter={filter} accounts={accounts} categories={categories} placeName={placeName} />
    <ListTotals transactions={transactions} />
    <Card className="py-0">
      <CardContent className="px-2">
        {transactions.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            条件に合う取引はありません
          </p>
        ) : (
          <ul>
            {transactions.map((transaction) => (
              <TransactionRow key={transaction.id} transaction={transaction} />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  </div>
);

export default TransactionsPage;
