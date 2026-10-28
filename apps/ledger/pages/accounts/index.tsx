import { Link, useRouter } from "@void/react";
import { ChevronRight } from "lucide-react";
import { useId } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isDate, monthOf } from "@/ledger/dates";
import { cn } from "@/lib/utils";
import { formatYen } from "@/web/format";
import { transactionsHref } from "@/web/transactionsHref";
import type { Props } from "./index.server";

/**
 * 口座 1 つ分の行。押すとその日の月の、その口座の取引の一覧へ移る。
 */
const BalanceRow = ({ balance, date }: { balance: Props["balances"][number]; date: string }) => (
  <li className="border-b last:border-b-0">
    <Link
      href={transactionsHref({ month: monthOf(date), accountId: balance.id })}
      className="flex items-center gap-3 px-2 py-3 hover:bg-muted/50"
    >
      <span className="flex-1 font-medium">{balance.name}</span>
      <span className={cn("font-medium tabular-nums", balance.balance < 0 && "text-destructive")}>
        {formatYen(balance.balance)}
      </span>
      <ChevronRight className="size-4 text-muted-foreground" />
    </Link>
  </li>
);

/**
 * 口座の残高の画面。
 */
const AccountsPage = ({ date, today, balances }: Props) => {
  const router = useRouter();
  const dateId = useId();
  const active = balances.filter((balance) => !balance.dormant);
  const dormant = balances.filter((balance) => balance.dormant);
  const total = balances.reduce((sum, balance) => sum + balance.balance, 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-xl font-semibold">口座の残高</h1>
        <div className="flex items-center gap-2">
          <Label htmlFor={dateId} className="text-muted-foreground">
            日付
          </Label>
          <Input
            id={dateId}
            type="date"
            className="w-40"
            value={date}
            max={today}
            onChange={(event) => {
              const next = event.target.value;
              if (isDate(next)) void router.visit(`/accounts?date=${next}`, { replace: true });
            }}
          />
        </div>
      </div>
      <Card className="py-0">
        <CardContent className="px-2">
          <ul>
            {active.map((balance) => (
              <BalanceRow key={balance.id} balance={balance} date={date} />
            ))}
          </ul>
          <div className="flex items-center gap-3 border-t px-2 py-3">
            <span className="flex-1 font-semibold">合計</span>
            <span className="font-semibold tabular-nums">{formatYen(total)}</span>
            <span className="size-4" />
          </div>
        </CardContent>
      </Card>
      {dormant.length > 0 && (
        <details className="group">
          <summary className="flex cursor-pointer list-none items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ChevronRight className="size-4 transition-transform group-open:rotate-90" />
            使っていない口座（{dormant.length}）
          </summary>
          <Card className="mt-2 py-0">
            <CardContent className="px-2">
              <ul>
                {dormant.map((balance) => (
                  <BalanceRow key={balance.id} balance={balance} date={date} />
                ))}
              </ul>
            </CardContent>
          </Card>
        </details>
      )}
    </div>
  );
};

export default AccountsPage;
