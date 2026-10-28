import { defineHandler } from "void";
import { db } from "void/db";
import {
  findRegisteredPayments,
  StatementMatchInputSchema,
} from "../../../src/ledger/statements.ts";

/**
 * 明細の各行に、登録済みの支出を割り当てて返す。DB は変えないが、行のリストを受け取るので POST にする。
 */
export const POST = defineHandler.withValidator({ body: StatementMatchInputSchema })(
  async (_c, { body }) => ({ matches: await findRegisteredPayments(db, body.entries) }),
);
