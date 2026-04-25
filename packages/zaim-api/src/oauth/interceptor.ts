import { buildOAuth1AuthorizationHeader, type OAuth1Config } from "../oauth/oauth1";

/** OAuth 1.0a の認証ヘッダーを設定するインターセプター */
export const createZaimAuthInterceptor = (oauthConfig: OAuth1Config) => {
  return async (req: Request) => {
    const url = new URL(req.url);

    const authHeader = await buildOAuth1AuthorizationHeader(
      req.method,
      `${url.protocol}//${url.host}${url.pathname}`,
      oauthConfig,
      {},
      Object.fromEntries(url.searchParams.entries()),
    );

    req.headers.set("Authorization", authHeader);
    return req;
  };
};
