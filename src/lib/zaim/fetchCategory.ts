import type { OAuthSign } from "~lib/oauth";
import { constructUrlWithParams } from "~lib/oauthHelper";

type ZaimCategoryRes = {
  categories: {
    id: number;
    mode: "payment" | "income";
    name: string;
    sort: number;
    active: number;
    modified: string;
    parent_category_id: number;
    local_id: number;
  }[];
  requested: string;
};

export const fetchZaimCategory = async (
  signer: OAuthSign
): Promise<ZaimCategoryRes> => {
  const { headers, request } = await signer({
    url: "https://api.zaim.net/v2/home/category",
    method: "GET",
    params: {},
  });

  const urlWithParams = constructUrlWithParams(request.url, request.params);
  const response = await fetch(urlWithParams, {
    method: request.method,
    headers: headers,
  });

  return (await response.json()) as ZaimCategoryRes;
};
