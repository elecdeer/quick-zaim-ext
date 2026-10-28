import * as v from "valibot";
import { defineHandler, defineHead, type InferProps } from "void";
import { db } from "void/db";
import { formatMonth, todayInTokyo, monthOf } from "../src/ledger/dates.ts";
import { summarizeMonth } from "../src/ledger/summary.ts";
import { OptionalMonthSchema } from "../src/web/params.ts";

export type Props = InferProps<typeof loader>;

const SummaryQuerySchema = v.object({ month: OptionalMonthSchema });

export const loader = defineHandler.withValidator({ query: SummaryQuerySchema })(async (
  _c,
  { query },
) => {
  const month = query.month ?? monthOf(todayInTokyo());
  return { month, summary: await summarizeMonth(db, month) };
});

export const head = defineHead<Props>((_c, props) => ({
  title: `${formatMonth(props.month)}の集計`,
}));
