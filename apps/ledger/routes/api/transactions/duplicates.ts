import { defineHandler } from "void";
import { db } from "void/db";
import { DuplicateCheckInputSchema, findDuplicates } from "../../../src/ledger/payments.ts";

/**
 * 登録しようとしている品目ごとに重複の候補を返す。DB は変えないが、品目のリストを受け取るので POST にする。
 */
export const POST = defineHandler.withValidator({ body: DuplicateCheckInputSchema })(
  async (_c, { body }) => ({ duplicates: await findDuplicates(db, body) }),
);
