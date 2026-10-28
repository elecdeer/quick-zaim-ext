import { Link } from "@void/react";
import { ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CategoryTotal, ModeSummary } from "@/ledger/summary";
import { cn } from "@/lib/utils";
import { MonthNavigation } from "@/web/components/MonthNavigation";
import { formatPercent, formatYen } from "@/web/format";
import { transactionsHref } from "@/web/transactionsHref";
import type { Props } from "./index.server";

/**
 * 支出・収入・収支の合計。
 */
const Totals = ({ payment, income }: { payment: number; income: number }) => {
  const balance = income - payment;
  const items = [
    { label: "支出", amount: payment, className: "" },
    { label: "収入", amount: income, className: "" },
    {
      label: "収支",
      amount: balance,
      className: balance < 0 ? "text-destructive" : "",
    },
  ];
  return (
    <div className="grid grid-cols-3 gap-3">
      {items.map((item) => (
        <Card key={item.label} size="sm">
          <CardHeader>
            <CardTitle className="text-sm font-normal text-muted-foreground">
              {item.label}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className={cn("text-lg font-semibold tabular-nums sm:text-2xl", item.className)}>
              {formatYen(item.amount)}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

const GENRE_ROW_CLASS = "flex items-baseline gap-2 rounded-md px-2 py-1.5 text-sm";

/**
 * カテゴリ 1 つ分の行。開くと内訳ごとの合計が出る。
 */
const CategoryRow = ({
  category,
  total,
  month,
  mode,
}: {
  category: CategoryTotal;
  total: number;
  month: string;
  mode: "payment" | "income";
}) => {
  const ratio = total > 0 ? Math.max(category.amount / total, 0) : 0;
  return (
    <details className="group border-b last:border-b-0">
      <summary className="flex cursor-pointer list-none flex-col gap-1.5 px-1 py-3 hover:bg-muted/50">
        <div className="flex items-baseline gap-2">
          <ChevronRight className="size-3.5 shrink-0 self-center text-muted-foreground transition-transform group-open:rotate-90" />
          <span className="font-medium">{category.name}</span>
          <span className="ml-auto text-xs text-muted-foreground tabular-nums">
            {formatPercent(category.amount, total)}
          </span>
          <span className="w-28 text-right font-medium tabular-nums">
            {formatYen(category.amount)}
          </span>
        </div>
        <div className="ml-5.5 h-1.5 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary" style={{ width: `${ratio * 100}%` }} />
        </div>
      </summary>
      <ul className="pb-2 pl-6">
        {category.genres.map((genre) => {
          const content = (
            <>
              <span>{genre.name}</span>
              <span className="ml-auto text-xs text-muted-foreground tabular-nums">
                {formatPercent(genre.amount, category.amount)}
              </span>
              <span className="w-28 text-right tabular-nums">{formatYen(genre.amount)}</span>
            </>
          );
          return (
            <li key={genre.genreId ?? "none"}>
              {/* 内訳のない品目は条件で絞り込めないので、一覧へのリンクにしない */}
              {category.categoryId !== null && genre.genreId !== null ? (
                <Link
                  href={transactionsHref({
                    month,
                    mode,
                    categoryId: category.categoryId,
                    genreId: genre.genreId,
                  })}
                  className={cn(GENRE_ROW_CLASS, "hover:bg-muted")}
                >
                  {content}
                </Link>
              ) : (
                <div className={GENRE_ROW_CLASS}>{content}</div>
              )}
            </li>
          );
        })}
        {category.categoryId !== null && (
          <li>
            <Link
              href={transactionsHref({ month, mode, categoryId: category.categoryId })}
              className="block px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:underline"
            >
              {category.name}の取引を見る
            </Link>
          </li>
        )}
      </ul>
    </details>
  );
};

/**
 * 支出か収入のカテゴリ別の合計。
 */
const CategoryBreakdown = ({
  title,
  summary,
  month,
  mode,
}: {
  title: string;
  summary: ModeSummary;
  month: string;
  mode: "payment" | "income";
}) => (
  <Card>
    <CardHeader>
      <CardTitle>{title}</CardTitle>
    </CardHeader>
    <CardContent>
      {summary.categories.length === 0 ? (
        <p className="text-sm text-muted-foreground">この月の記録はありません</p>
      ) : (
        <div>
          {summary.categories.map((category) => (
            <CategoryRow
              key={category.categoryId ?? "none"}
              category={category}
              total={summary.total}
              month={month}
              mode={mode}
            />
          ))}
        </div>
      )}
    </CardContent>
  </Card>
);

/**
 * 月ごとの集計の画面。
 */
const SummaryPage = ({ month, summary }: Props) => (
  <div className="flex flex-col gap-6">
    <MonthNavigation month={month} hrefOf={(target) => `/?month=${target}`} />
    <Totals payment={summary.payment.total} income={summary.income.total} />
    <CategoryBreakdown
      title="支出のカテゴリ別"
      summary={summary.payment}
      month={month}
      mode="payment"
    />
    <CategoryBreakdown
      title="収入のカテゴリ別"
      summary={summary.income}
      month={month}
      mode="income"
    />
  </div>
);

export default SummaryPage;
