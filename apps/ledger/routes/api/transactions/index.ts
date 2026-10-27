import { defineHandler } from "void";
import { db } from "void/db";
import { createPayment, PaymentInputSchema } from "../../../src/ledger/payments.ts";

/**
 * 支出を登録する。作成でも 200 を返す（Void では c.status(201) を指定しても値を返すと 200 になり、
 * c.json(x, 201) にするとレスポンスの型が推論されなくなるため）。
 */
export const POST = defineHandler.withValidator({ body: PaymentInputSchema })(async (
  c,
  { body },
) => {
  const result = await createPayment(db, body);
  if (!result.ok) return c.json({ error: result.error }, 400);
  return { id: result.id };
});
