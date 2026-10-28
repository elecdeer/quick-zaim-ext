import * as v from "valibot";
import { defineHandler, defineHead, type InferProps } from "void";
import { db } from "void/db";
import { computeBalances, isDormant } from "../../src/ledger/balances.ts";
import { todayInTokyo } from "../../src/ledger/dates.ts";
import { OptionalDateSchema } from "../../src/web/params.ts";

export type Props = InferProps<typeof loader>;

const AccountsQuerySchema = v.object({ date: OptionalDateSchema });

export const loader = defineHandler.withValidator({ query: AccountsQuerySchema })(async (
  _c,
  { query },
) => {
  const today = todayInTokyo();
  const date = query.date ?? today;
  const balances = await computeBalances(db, date);
  // 判定は loader でする。画面から balances.ts を読み込むと、スキーマがブラウザ向けのバンドルに入ってビルドが通らないため
  return {
    date,
    today,
    balances: balances.map((balance) => ({ ...balance, dormant: isDormant(balance, date) })),
  };
});

export const head = defineHead(() => ({ title: "口座の残高" }));
