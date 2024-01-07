import { objectToSearchParams } from "~lib/oauthHelper";
import { zaimApi } from "./api";

type ZaimPaymentReq = {
  mapping: 1;
  /** category id for payment */
  category_id: number;
  /** genre id for payment */
  genre_id: number;
  /** amount without decimal point */
  amount: number;
  /** date of Y-m-d format (past/future 5 years is valid) */
  date: string;
  /** account id for payment */
  from_account_id?: number | undefined;
  /** comment (within 100 characters) */
  comment?: string | undefined;
  /** product name (within 100 characters) */
  name?: string | undefined;
  /** place name (within 100 characters) */
  place?: string | undefined;
};

// TODO 正しく型を定義する
type ZaimPaymentRes = unknown;

export const postZaimPayment = async (
  req: ZaimPaymentReq
): Promise<ZaimPaymentRes> => {
  return await zaimApi
    .post("home/money/payment", {
      searchParams: objectToSearchParams(req),
    })
    .json<ZaimPaymentRes>();
};
