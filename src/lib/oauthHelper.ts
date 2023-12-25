import type { AuthorizationHeader } from "~lib/oauth";

export const parseOAuthTokenFromResponse = (response: string) => {
  const params = new URLSearchParams(response);
  const oauthToken = params.get("oauth_token");
  const oauthTokenSecret = params.get("oauth_token_secret");

  if (oauthToken === null || oauthTokenSecret === null) {
    throw new Error("Failed to parse OAuth token");
  }

  return {
    oauthToken: oauthToken,
    oauthTokenSecret: oauthTokenSecret,
  };
};

export const generateNonce = (): string => {
  return crypto.randomUUID();
};

export const generateTimestamp = (): string => {
  return Math.floor(Date.now() / 1000).toString();
};

/**
 * Create signature base string
 * @see https://openid-foundation-japan.github.io/rfc5849.ja.html#anchor6
 *
 * @param httpMethod
 * @param requestUri
 * @param params
 */
export const createSignatureBaseString = (
  httpMethod: string,
  requestUri: string,
  params: Record<string, string>,
) => {
  const sortedKeys = Object.keys(params).sort();
  const paramString = sortedKeys
    .map((key) => {
      const encodedKey = encodeURIComponent(key);
      const encodedValue = encodeURIComponent(params[key]);
      return `${encodedKey}=${encodedValue}`;
    })
    .join("&");

  return [
    httpMethod.toUpperCase(),
    encodeURIComponent(requestUri),
    encodeURIComponent(paramString),
  ].join("&");
};

export const createSignatureKey = (
  consumerSecret: string,
  tokenSecret: string | undefined,
) => {
  const encodedConsumerSecret = encodeURIComponent(consumerSecret);
  const encodedTokenSecret = encodeURIComponent(tokenSecret ?? "");
  return [encodedConsumerSecret, encodedTokenSecret].join("&");
};

// 署名の生成
export const createSignature = async (baseString: string, key: string) => {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(key);
  const message = encoder.encode(baseString);

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, message);
  return btoa(String.fromCharCode(...new Uint8Array(signature)));
};

// OAuthヘッダの作成
export const createOAuthHeader = (
  params: Record<string, string>,
): AuthorizationHeader => {
  const value =
    "OAuth " +
    Object.keys(params)
      .map(
        (key) =>
          `${encodeURIComponent(key)}="${encodeURIComponent(params[key])}"`,
      )
      .join(", ");

  return {
    Authorization: value,
  };
};
