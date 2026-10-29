import { Link, useRouter } from "@void/react";
import { useState } from "react";
import { submitAction } from "void/pages-client";
import { Maximize2, RotateCcw, TriangleAlert, X } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  TransactionFilter,
  TransactionListItem,
  TransactionMode,
} from "@/ledger/transactions";
import { cn } from "@/lib/utils";
import { categoryLabels, categoryValueOf, parseCategoryValue } from "@/web/categoryValue";
import { Section } from "@/web/components/Section";
import { TransactionEditor } from "@/web/components/TransactionEditor";
import { CategoryOptions } from "@/web/components/CategoryOptions";
import { MonthHeading } from "@/web/components/MonthHeading";
import { formatAmount, formatDayOfMonth } from "@/web/format";
import { groupByDate } from "@/web/groupByDate";
import { MODE_LABELS } from "@/web/labels";
import { isFiltered, transactionsHref } from "@/web/transactionsHref";
import type { Props } from "./index.server";

const MODES: TransactionMode[] = ["payment", "income", "transfer", "adjustment"];

/**
 * 種類・口座・カテゴリの絞り込み。選ぶとすぐにその条件の一覧へ移る。
 * 何か絞り込んでいれば、月だけを残してすべて外すリセットを出す。
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
  const modeItems: Record<string, string> = { "": "すべての種類", ...MODE_LABELS };
  const accountItems: Record<string, string> = {
    "": "すべての口座",
    ...Object.fromEntries(accounts.map((account) => [String(account.id), account.name])),
  };
  const categoryItems: Record<string, string> = {
    "": "すべてのカテゴリ",
    ...categoryLabels(categories.payment),
    ...categoryLabels(categories.income),
  };

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
      <Select
        items={modeItems}
        value={filter.mode ?? ""}
        onValueChange={(value) => {
          const mode = MODES.find((candidate) => candidate === value);
          visit({ mode });
        }}
      >
        <SelectTrigger size="sm" aria-label="種類">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="">すべての種類</SelectItem>
          {MODES.map((mode) => (
            <SelectItem key={mode} value={mode}>
              {MODE_LABELS[mode]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        items={accountItems}
        value={filter.accountId === undefined ? "" : String(filter.accountId)}
        onValueChange={(value) =>
          visit({ accountId: value === null || value === "" ? undefined : Number(value) })
        }
      >
        <SelectTrigger size="sm" aria-label="口座">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="">すべての口座</SelectItem>
          {accounts.map((account) => (
            <SelectItem key={account.id} value={String(account.id)}>
              {account.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        items={categoryItems}
        value={categoryValueOf(filter.categoryId ?? null, filter.genreId ?? null)}
        onValueChange={(value) => {
          const { categoryId, genreId } = parseCategoryValue(value ?? "");
          visit({ categoryId: categoryId ?? undefined, genreId: genreId ?? undefined });
        }}
      >
        <SelectTrigger size="sm" aria-label="カテゴリ">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="">すべてのカテゴリ</SelectItem>
          <CategoryOptions label="支出" categories={categories.payment} />
          <CategoryOptions label="収入" categories={categories.income} />
        </SelectContent>
      </Select>
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
      {isFiltered(filter) && (
        <Link
          href={transactionsHref({ month: filter.month })}
          preserveScroll
          className="flex h-7 items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <RotateCcw className="size-3.5" aria-hidden="true" />
          リセット
        </Link>
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

/** サイドパネルで詳細を開く画面の幅。一覧とパネルを並べても一覧の 12 列のグリッドが崩れない幅にする */
const SIDE_PANEL_MEDIA = "(min-width: 80rem)";

/**
 * 取引 1 件の行。押すと編集画面へ移る。広い画面では画面を移らず、一覧の横のサイドパネルで開く。
 *
 * 振替と残高調整はお金の出入りではないので、行全体を薄くして支出・収入と見分ける。
 */
const TransactionRow = ({
  transaction,
  filter,
  selected,
}: {
  transaction: TransactionListItem;
  filter: TransactionFilter;
  selected: boolean;
}) => {
  const router = useRouter();
  const summary = itemsSummaryOf(transaction);
  const accountName = accountsOf(transaction);
  const details = [summary, ...categoriesOf(transaction)].filter((value) => value !== null);
  const isMove = transaction.mode === "transfer" || transaction.mode === "adjustment";
  return (
    <li className="border-b">
      <Link
        // JavaScript が動く前や狭い画面では、取引の画面へ移る
        href={`/transactions/${transaction.id}`}
        aria-current={selected ? "true" : undefined}
        onNavigate={(event) => {
          if (!window.matchMedia(SIDE_PANEL_MEDIA).matches) return;
          event.preventDefault();
          void router.visit(transactionsHref(filter, transaction.id), { preserveScroll: true });
        }}
        className={cn(
          "grid grid-cols-[minmax(0,1fr)_6rem] items-baseline gap-x-4 py-2.5 hover:bg-muted/60 sm:grid-cols-[minmax(0,1fr)_9rem_6rem]",
          isMove && "text-muted-foreground",
          selected && "bg-muted",
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
 * 広い画面で一覧の横に出す、取引の編集のパネル。
 *
 * 取引の画面のアクションを呼ぶとその画面へ移ってしまうので、一覧の画面のアクションを一覧のクエリ付きで呼び、
 * 一覧とパネルをその場で描き直す。
 */
const SidePanel = ({
  filter,
  selected,
  accounts,
  categories,
}: Pick<Props, "filter" | "accounts" | "categories"> & {
  selected: NonNullable<Props["selected"]>;
}) => {
  const router = useRouter();
  // 別の取引を開いても「保存しました」が残らないよう、保存した取引の ID で持つ
  const [savedId, setSavedId] = useState<number | null>(null);
  const { transaction } = selected;
  // 名前付きのアクションは `?update` のようにクエリの先頭に名前を付けて呼ぶ。残りのクエリが描き直す一覧になる
  const actionUrl = (name: "update" | "delete", selectedId?: number) =>
    `/transactions?${name}&${transactionsHref(filter, selectedId).split("?")[1]}`;

  return (
    <aside
      aria-label="取引の編集"
      className="hidden xl:sticky xl:top-4 xl:flex xl:max-h-[calc(100dvh-2rem)] xl:flex-col xl:gap-4 xl:overflow-y-auto xl:overscroll-contain xl:border-l xl:pl-6"
    >
      <div className="flex items-center justify-end gap-1">
        <Link
          href={`/transactions/${transaction.id}`}
          aria-label="取引の画面で開く"
          className="p-1 text-muted-foreground hover:text-foreground"
        >
          <Maximize2 className="size-4" aria-hidden="true" />
        </Link>
        <Link
          href={transactionsHref(filter)}
          preserveScroll
          aria-label="パネルを閉じる"
          className="p-1 text-muted-foreground hover:text-foreground"
        >
          <X className="size-4" aria-hidden="true" />
        </Link>
      </div>
      {/* 保存すると loader の値が変わるので、key を変えて入力中の値を保存した内容で作り直す */}
      <TransactionEditor
        key={JSON.stringify(transaction)}
        transaction={transaction}
        accounts={accounts}
        categories={categories}
        placeNames={selected.placeNames}
        saved={savedId === transaction.id}
        onSavedChange={(saved) => setSavedId(saved ? transaction.id : null)}
        onSave={(input) =>
          submitAction(router, actionUrl("update", transaction.id), {
            method: "POST",
            data: input,
            preserveScroll: true,
          })
        }
        onDelete={() =>
          // selected を外した一覧に送り、消したあとはパネルを閉じた一覧にする
          submitAction(router, actionUrl("delete"), {
            method: "POST",
            data: { id: transaction.id },
            preserveScroll: true,
          })
        }
      />
    </aside>
  );
};

/**
 * 取引の一覧の画面。日付ごとにまとめ、日付を左の列に出す。
 * 広い画面で取引を選ぶと、一覧の右にサイドパネルを開いてその場で編集できる。
 */
const TransactionsPage = ({
  filter,
  transactions,
  accounts,
  categories,
  placeName,
  selected,
}: Props) => (
  <div
    className={cn(
      "grid gap-x-8",
      selected !== null && "xl:grid-cols-[minmax(0,1fr)_28rem] xl:items-start",
    )}
  >
    <div className="flex min-w-0 flex-col gap-8">
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
                  <TransactionRow
                    key={transaction.id}
                    transaction={transaction}
                    filter={filter}
                    selected={selected?.transaction.id === transaction.id}
                  />
                ))}
              </ul>
            </Section>
          ))}
        </div>
      )}
    </div>
    {selected !== null && (
      <SidePanel filter={filter} selected={selected} accounts={accounts} categories={categories} />
    )}
  </div>
);

export default TransactionsPage;
