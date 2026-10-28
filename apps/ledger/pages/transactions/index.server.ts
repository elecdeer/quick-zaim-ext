import { eq } from "drizzle-orm";
import * as v from "valibot";
import { defineHandler, defineHead, type InferProps } from "void";
import { db } from "void/db";
import { places } from "@schema";
import { formatMonth, monthOf, todayInTokyo } from "../../src/ledger/dates.ts";
import { listAccounts, listCategories } from "../../src/ledger/masters.ts";
import { listTransactions, type TransactionFilter } from "../../src/ledger/transactions.ts";
import { OptionalIdSchema, OptionalMonthSchema } from "../../src/web/params.ts";

export type Props = InferProps<typeof loader>;

const TransactionsQuerySchema = v.object({
  month: OptionalMonthSchema,
  mode: v.optional(v.picklist(["payment", "income", "transfer", "adjustment"])),
  accountId: OptionalIdSchema,
  categoryId: OptionalIdSchema,
  genreId: OptionalIdSchema,
  placeId: OptionalIdSchema,
});

export const loader = defineHandler.withValidator({ query: TransactionsQuerySchema })(async (
  _c,
  { query },
) => {
  const filter: TransactionFilter = { ...query, month: query.month ?? monthOf(todayInTokyo()) };
  const [transactions, accounts, paymentCategories, incomeCategories, place] = await Promise.all([
    listTransactions(db, filter),
    listAccounts(db),
    listCategories(db, "payment"),
    listCategories(db, "income"),
    filter.placeId === undefined
      ? undefined
      : db
          .select({ id: places.id, name: places.name })
          .from(places)
          .where(eq(places.id, filter.placeId))
          .get(),
  ]);
  return {
    filter,
    transactions,
    accounts,
    categories: { payment: paymentCategories, income: incomeCategories },
    placeName: place?.name ?? null,
  };
});

export const head = defineHead<Props>((_c, props) => ({
  title: `${formatMonth(props.filter.month)}の取引`,
}));
