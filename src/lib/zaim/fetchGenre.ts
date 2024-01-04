import type { OAuthSign } from "~lib/oauth";
import { constructUrlWithParams } from "~lib/oauthHelper";

type ZaimGenreRes = {
  genres: {
    id: number;
    category_id: number;
    name: string;
    sort: number;
    active: number;
    modified: string;
    parent_genre_id: number;
    local_id: number;
  }[];
  requested: string;
};

export const fetchZaimGenre = async (
  signer: OAuthSign
): Promise<ZaimGenreRes> => {
  const { headers, request } = await signer({
    url: "https://api.zaim.net/v2/home/genre",
    method: "GET",
    params: {},
  });

  const urlWithParams = constructUrlWithParams(request.url, request.params);
  const response = await fetch(urlWithParams, {
    method: request.method,
    headers: headers,
  });

  return (await response.json()) as ZaimGenreRes;
};
