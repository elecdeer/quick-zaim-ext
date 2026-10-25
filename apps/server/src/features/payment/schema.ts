import * as v from "valibot";

export const PaymentBodySchema = v.object({
  category_id: v.pipe(v.number(), v.integer()),
  genre_id: v.pipe(v.number(), v.integer()),
  amount: v.pipe(v.number(), v.integer(), v.minValue(1)),
  date: v.pipe(v.string(), v.regex(/^\d{4}-\d{2}-\d{2}$/)),
  from_account_id: v.optional(v.pipe(v.number(), v.integer())),
  comment: v.optional(v.string()),
  name: v.optional(v.string()),
  place_uid: v.optional(v.string()),
});

export const DuplicateQuerySchema = v.object({
  date: v.pipe(v.string(), v.regex(/^\d{4}-\d{2}-\d{2}$/)),
  amount: v.pipe(
    v.string(),
    v.transform(Number),
    v.check((n) => Number.isInteger(n) && n > 0, "amount must be a positive integer"),
  ),
  genre_id: v.pipe(
    v.string(),
    v.transform(Number),
    v.check((n) => Number.isInteger(n), "genre_id must be an integer"),
  ),
});

/** 1 回の一括重複チェックで受け付ける明細行数の上限 */
const BULK_DUPLICATE_MAX_ENTRIES = 500;

export const BulkDuplicateBodySchema = v.object({
  entries: v.pipe(
    v.array(
      v.object({
        date: v.pipe(v.string(), v.regex(/^\d{4}-\d{2}-\d{2}$/)),
        amount: v.pipe(v.number(), v.integer(), v.minValue(1)),
      }),
    ),
    v.maxLength(BULK_DUPLICATE_MAX_ENTRIES),
  ),
});
