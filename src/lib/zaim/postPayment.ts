import type { OAuthSign } from "~lib/oauth";
import { constructUrlWithParams } from "~lib/oauthHelper";

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

type ZaimPaymentRes = unknown;

export const postZaimPayment = async (
  signer: OAuthSign,
  req: ZaimPaymentReq
): Promise<ZaimPaymentRes> => {
  const { headers, request } = await signer({
    url: "https://api.zaim.net/v2/home/money/payment",
    method: "POST",
    params: req,
  });

  const urlWithParams = constructUrlWithParams(request.url, request.params);
  console.log(urlWithParams);
  const response = await fetch(urlWithParams, {
    method: request.method,
    headers: headers,
  });

  return (await response.json()) as ZaimPaymentRes;
};
