import type { OAuthSign } from "~lib/oauth";
import { constructUrlWithParams } from "~lib/oauthHelper";

export type ZaimAccountRes = {
  accounts: {
    id: number;
    name: string;
  }[];
  requested: string;
};

export const fetchZaimAccount = async (
  signer: OAuthSign
): Promise<ZaimAccountRes> => {
  const { headers, request } = await signer({
    url: "https://api.zaim.net/v2/home/account",
    method: "GET",
    params: {},
  });

  const urlWithParams = constructUrlWithParams(request.url, request.params);
  const response = await fetch(urlWithParams, {
    method: request.method,
    headers: headers,
  });

  return (await response.json()) as ZaimAccountRes;
};
