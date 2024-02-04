import { objectToSearchParams } from "~lib/oauthHelper";
import { zaimApi } from "./api";

export type ZaimPaymentReq = {
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
  /** place name (within 100 characters) 使用不可？ 指定すると400エラーになる */
  // place?: string | undefined;

  /** undocumented placeの代わりにこちらを指定する必要がある*/
  place_uid?: string | undefined;
  /** undocumented 同じ値を割り当てたレコードはZaim上でまとめて表示される 10桁である必要がある？ */
  receipt_id?: number | undefined;
};

export type ZaimPaymentRes = {
  banners: unknown[];
  money: {
    id: string;
    modified: string;
  };
  requested: number;
  stamp: unknown;
  user: {
    data_modified: string;
    input_count: number;
  };
};

export const postZaimPayment = async (
  req: ZaimPaymentReq
): Promise<ZaimPaymentRes> => {
  return await zaimApi
    .post("home/money/payment", {
      searchParams: objectToSearchParams(req),
    })
    .json<ZaimPaymentRes>();
};
