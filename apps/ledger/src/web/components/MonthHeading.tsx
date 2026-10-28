import { Link } from "@void/react";
import { formatMonth, shiftMonth } from "@/ledger/dates";

/**
 * 「10月」の形で月だけを書く。前後の月へのリンクは年をまたいでも月だけで足りる。
 */
const monthLabel = (month: string): string => `${Number(month.slice(5))}月`;

/**
 * 画面が扱う月。年の下に月を大きく出し、前後の月へのリンクを添える。移り先の URL は hrefOf で月から作る。
 */
export const MonthHeading = ({
  month,
  hrefOf,
}: {
  month: string;
  hrefOf: (month: string) => string;
}) => {
  const previous = shiftMonth(month, -1);
  const next = shiftMonth(month, 1);
  return (
    <div className="flex flex-col gap-1">
      <div className="flex gap-4 text-xs text-muted-foreground">
        <Link href={hrefOf(previous)} className="hover:text-foreground">
          ← {monthLabel(previous)}
        </Link>
        <Link href={hrefOf(next)} className="hover:text-foreground">
          {monthLabel(next)} →
        </Link>
      </div>
      <h1 aria-label={formatMonth(month)} className="flex flex-col">
        <span className="text-xs text-muted-foreground">{month.slice(0, 4)}</span>
        <span className="text-6xl leading-none font-semibold tracking-tighter">
          {Number(month.slice(5))}
        </span>
      </h1>
    </div>
  );
};
