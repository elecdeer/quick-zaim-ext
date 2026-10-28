import { Link } from "@void/react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { formatMonth, shiftMonth } from "@/ledger/dates";

const NAV_LINK_CLASS =
  "flex items-center gap-1 rounded-md p-2 text-sm text-muted-foreground hover:bg-muted";

/**
 * 前の月・次の月へ移るヘッダー。移り先の URL は hrefOf で月から作る。
 */
export const MonthNavigation = ({
  month,
  hrefOf,
}: {
  month: string;
  hrefOf: (month: string) => string;
}) => {
  const previous = shiftMonth(month, -1);
  const next = shiftMonth(month, 1);
  return (
    <div className="flex items-center justify-between">
      <Link href={hrefOf(previous)} className={NAV_LINK_CLASS} aria-label="前の月">
        <ChevronLeft className="size-4" />
        <span className="hidden sm:inline">{formatMonth(previous)}</span>
      </Link>
      <h1 className="text-xl font-semibold">{formatMonth(month)}</h1>
      <Link href={hrefOf(next)} className={NAV_LINK_CLASS} aria-label="次の月">
        <span className="hidden sm:inline">{formatMonth(next)}</span>
        <ChevronRight className="size-4" />
      </Link>
    </div>
  );
};
