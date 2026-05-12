/**
 * Zaim API の OAuth 1.0a 認証ヘルパー
 *
 * Zaim 固有のエンドポイント URL とトークン取得ロジックをまとめる。
 * 汎用 OAuth 1.0a 署名処理は oauth1.ts に委譲する。
 *
 * Zaim OAuth フロー:
 *   1. Request Token 取得: POST https://api.zaim.net/v2/auth/request
 *   2. ユーザー認可: https://auth.zaim.net/users/auth?oauth_token=...
 *   3. Access Token 取得: POST https://api.zaim.net/v2/auth/access
 *   4. ユーザー ID 取得: GET https://api.zaim.net/v2/home/user/verify
 */

import { authAccessToken, authRequestToken, userVerifyUser } from "@repo/zaim-api";
import { createClient } from "@repo/zaim-api/client";
import { createZaimAuthInterceptor } from "@repo/zaim-api/oauth/interceptor";
import { type OAuth1Config, buildOAuth1AuthorizationHeader } from "@repo/zaim-api/oauth/oauth1";
import type { AccessTokenResult, RequestTokenResult } from "@repo/zaim-api/oauth/zaim-oauth";
import * as v from "valibot";
import { zaimOAuthLogger } from "./logger.ts";

export { buildZaimApiAuthHeader, buildZaimAuthorizeUrl } from "@repo/zaim-api/oauth/zaim-oauth";
export type { AccessTokenResult, RequestTokenResult } from "@repo/zaim-api/oauth/zaim-oauth";

const ZAIM_API_BASE = "https://api.zaim.net";
const zaimClient = createClient({ baseUrl: ZAIM_API_BASE });

const RequestTokenSchema = v.object({
  oauth_token: v.string(),
  oauth_token_secret: v.string(),
});

const AccessTokenSchema = v.object({
  oauth_token: v.string(),
  oauth_token_secret: v.string(),
});

const UserVerifySchema = v.object({
  me: v.object({
    id: v.number(),
  }),
});

/**
 * Zaim から Request Token を取得する
 * @param config      - Consumer Key / Secret
 * @param callbackUrl - OAuth 認可後のコールバック URL
 */
export async function fetchZaimRequestToken(
  config: OAuth1Config,
  callbackUrl: string,
): Promise<RequestTokenResult> {
  const requestUrl = `${ZAIM_API_BASE}/v2/auth/request`;
  const authHeader = await buildOAuth1AuthorizationHeader("POST", requestUrl, config, {
    oauth_callback: callbackUrl,
  });

  zaimOAuthLogger.with({ url: requestUrl, callbackUrl }).debug("Fetching Zaim request token");

  const { data, error, response } = await authRequestToken({
    client: zaimClient,
    headers: { Authorization: authHeader },
  });

  if (error || !data) {
    zaimOAuthLogger
      .with({ status: response.status, body: error })
      .error("Zaim request token fetch failed [{status}]: {body}");
    throw new Error(`Request token failed [${response.status}]: ${JSON.stringify(error)}`);
  }

  const parsed = v.parse(RequestTokenSchema, Object.fromEntries(new URLSearchParams(data)));

  zaimOAuthLogger
    .with({ oauthToken: parsed.oauth_token })
    .debug("Zaim request token obtained: {oauthToken}");

  return { oauthToken: parsed.oauth_token, oauthTokenSecret: parsed.oauth_token_secret };
}

/**
 * Request Token と Verifier を使って Access Token を取得する
 *
 * Zaim の /v2/auth/access はレスポンスに user_id を含まないため、
 * ユーザー ID が必要な場合は fetchZaimUserId を別途呼び出すこと。
 *
 * @param config        - Consumer Key / Secret + Request Token / Secret
 * @param oauthVerifier - Zaim から受け取った oauth_verifier
 */
export async function fetchZaimAccessToken(
  config: OAuth1Config,
  oauthVerifier: string,
): Promise<AccessTokenResult> {
  const accessUrl = `${ZAIM_API_BASE}/v2/auth/access`;
  const authHeader = await buildOAuth1AuthorizationHeader("POST", accessUrl, config, {
    oauth_verifier: oauthVerifier,
  });

  zaimOAuthLogger.with({ url: accessUrl }).debug("Fetching Zaim access token");

  const { data, error, response } = await authAccessToken({
    client: zaimClient,
    headers: { Authorization: authHeader },
  });

  if (error || !data) {
    zaimOAuthLogger
      .with({ status: response.status, body: error })
      .error("Zaim access token fetch failed [{status}]: {body}");
    throw new Error(`Access token failed [${response.status}]: ${JSON.stringify(error)}`);
  }

  const parsed = v.parse(AccessTokenSchema, Object.fromEntries(new URLSearchParams(data)));

  zaimOAuthLogger.debug("Zaim access token obtained");

  return { oauthToken: parsed.oauth_token, oauthTokenSecret: parsed.oauth_token_secret };
}

/**
 * アクセストークンを使って Zaim のユーザー ID を取得する
 * @param config - Consumer Key / Secret + Access Token / Secret
 */
export async function fetchZaimUserId(config: OAuth1Config): Promise<string> {
  const client = createClient({ baseUrl: ZAIM_API_BASE });
  client.interceptors.request.use(createZaimAuthInterceptor(config));

  zaimOAuthLogger.debug("Fetching Zaim user ID");

  const { data, error, response } = await userVerifyUser({ client });

  if (error || !data) {
    zaimOAuthLogger
      .with({ status: response.status, body: error })
      .error("Zaim user verify failed [{status}]: {body}");
    throw new Error(`User verify failed [${response.status}]: ${JSON.stringify(error)}`);
  }

  const parsed = v.parse(UserVerifySchema, data);
  const userId = String(parsed.me.id);

  zaimOAuthLogger.with({ zaimUserId: userId }).debug("Zaim user ID obtained: {zaimUserId}");

  return userId;
}
