import { paymentOperationsCreate } from "@repo/zaim-api";
import type { createClient } from "@repo/zaim-api/client";
import type { Logger } from "../../loggerMiddleware.ts";
import { toZaimApiErrorContext } from "../../zaimApiError.ts";

type CreatePaymentParams = {
  category_id: number;
  genre_id: number;
  amount: number;
  date: string;
  from_account_id?: number;
  comment?: string;
  name?: string;
  place_uid?: string;
};

type CreatePaymentResult =
  | {
      success: true;
      data: { id: number; modified: string; placeUid?: string };
    }
  | {
      success: false;
      error: { upstreamStatus: number | undefined; upstreamMessage: string };
    };

/**
 * Zaim API に支払いを登録する。
 */
export const createPayment = async (
  client: ReturnType<typeof createClient>,
  params: CreatePaymentParams,
  logger: Logger,
): Promise<CreatePaymentResult> => {
  const result = await paymentOperationsCreate({
    client,
    query: {
      mapping: 1,
      category_id: params.category_id,
      genre_id: params.genre_id,
      amount: params.amount,
      date: params.date,
      ...(params.from_account_id !== undefined && { from_account_id: params.from_account_id }),
      ...(params.comment !== undefined && { comment: params.comment }),
      ...(params.name !== undefined && { name: params.name }),
      ...(params.place_uid !== undefined && { place_uid: params.place_uid }),
    },
  });

  if (!result.data) {
    const errCtx = toZaimApiErrorContext(result);
    logger
      .with({
        categoryId: params.category_id,
        genreId: params.genre_id,
        amount: params.amount,
        date: params.date,
        ...errCtx,
      })
      .error(
        "Failed to create payment in Zaim API (amount={amount}, date={date}, categoryId={categoryId}, genreId={genreId}): {upstreamMessage}",
      );
    return {
      success: false,
      error: { upstreamStatus: errCtx.upstreamStatus, upstreamMessage: errCtx.upstreamMessage },
    };
  }

  return {
    success: true,
    data: {
      id: result.data.money.id,
      modified: result.data.money.modified,
      ...(result.data.money.place_uid !== undefined && {
        placeUid: result.data.money.place_uid,
      }),
    },
  };
};
