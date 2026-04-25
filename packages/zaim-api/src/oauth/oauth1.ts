/**
 * OAuth 1.0a コア実装 (Web Crypto API 使用、Cloudflare Workers 対応)
 *
 * 特定サービスに依存しない汎用 OAuth 1.0a Authorization ヘッダー生成。
 */

export interface OAuth1Config {
  consumerKey: string;
  consumerSecret: string;
  token?: string;
  tokenSecret?: string;
}

/** HMAC-SHA1 署名を Base64 エンコードして返す */
async function hmacSha1Base64(key: string, data: string): Promise<string> {
  const encoder = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(key),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(data));
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

/** RFC 3986 準拠のパーセントエンコード */
function pct(str: string): string {
  return encodeURIComponent(str).replace(
    /[!'()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

/**
 * OAuth 1.0a の Authorization ヘッダーを生成する
 *
 * @param method            - HTTP メソッド (GET / POST)
 * @param baseUrl           - クエリ文字列を含まないリクエスト URL
 * @param config            - Consumer Key/Secret とオプションのアクセストークン
 * @param extraOAuthParams  - oauth_callback / oauth_verifier など追加 OAuth パラメータ
 * @param bodyOrQueryParams - 署名対象に含める本文またはクエリパラメータ
 */
export async function buildOAuth1AuthorizationHeader(
  method: string,
  baseUrl: string,
  config: OAuth1Config,
  extraOAuthParams: Record<string, string> = {},
  bodyOrQueryParams: Record<string, string> = {},
): Promise<string> {
  const oauthParams: Record<string, string> = {
    oauth_consumer_key: config.consumerKey,
    oauth_nonce: crypto.randomUUID().replace(/-/g, ""),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_version: "1.0",
    ...extraOAuthParams,
  };

  if (config.token) {
    oauthParams.oauth_token = config.token;
  }

  // 署名ベース文字列: すべてのパラメータをソートして結合
  const allParams = { ...oauthParams, ...bodyOrQueryParams };
  const paramString = Object.entries(allParams)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${pct(k)}=${pct(v)}`)
    .join("&");

  const baseString = `${method.toUpperCase()}&${pct(baseUrl)}&${pct(paramString)}`;
  const signingKey = `${pct(config.consumerSecret)}&${pct(config.tokenSecret ?? "")}`;

  oauthParams.oauth_signature = await hmacSha1Base64(signingKey, baseString);

  const headerValue = Object.entries(oauthParams)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${pct(k)}="${pct(v)}"`)
    .join(", ");

  return `OAuth ${headerValue}`;
}
