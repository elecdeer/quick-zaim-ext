/**
 * Zaim OAuth 1.0a 認可フロー用ルート
 *
 * エンドポイント一覧:
 *   GET  /zaim/auth/start    - Zaim OAuth 開始（Zaim 認可画面へリダイレクト、または authorizeUrl を返す）
 *   GET  /zaim/auth/callback - Zaim からのコールバック（アクセストークン取得・保存）
 *   GET  /zaim/auth/status   - Zaim 連携状態確認
 *   DELETE /zaim/auth/token  - Zaim 連携解除（トークン削除）
 *
 * KV キー設計:
 *   zaim:request:{oauth_token}  - Request Token シークレット（TTL 10分）
 *   zaim:token:{oidc_sub}       - Access Token（永続）
 */

import { sValidator } from "@hono/standard-validator";
import { Hono } from "hono";
import * as v from "valibot";
import type { Env, HonoEnv } from "../env.ts";
import {
  buildZaimAuthorizeUrl,
  fetchZaimAccessToken,
  fetchZaimRequestToken,
  fetchZaimUserId,
} from "../zaim-oauth.ts";
import { zaimRoutesLogger } from "../logger.ts";

/** Request Token の有効期限（秒） */
const REQUEST_TOKEN_TTL = 600;

const RequestTokenStateSchema = v.object({
  tokenSecret: v.string(),
  /** Request Token 取得時点でのログインユーザーの OIDC sub */
  userSub: v.string(),
  /** 拡張機能フロー時のみ: トークン交換後にリダイレクトする chromiumapp.org URL */
  extRedirectUri: v.optional(v.string()),
});

const StoredAccessTokenSchema = v.object({
  oauthToken: v.string(),
  oauthTokenSecret: v.string(),
  zaimUserId: v.string(),
});

const CallbackQuerySchema = v.object({
  oauth_token: v.string(),
  oauth_verifier: v.string(),
});

const StartQuerySchema = v.object({
  ext_redirect_uri: v.optional(v.string()),
});

type RequestTokenState = v.InferOutput<typeof RequestTokenStateSchema>;
type StoredAccessToken = v.InferOutput<typeof StoredAccessTokenSchema>;

function isValidExtensionRedirectUri(uri: string): boolean {
  try {
    const url = new URL(uri);
    return url.protocol === "https:" && url.hostname.endsWith(".chromiumapp.org");
  } catch {
    return false;
  }
}

/**
 * oauth_token + oauth_verifier からアクセストークンを取得して KV に保存する共通処理。
 * callbackRoute から呼ばれる。
 */
async function performZaimTokenExchange(
  env: Env,
  oauthToken: string,
  oauthVerifier: string,
): Promise<{ zaimUserId: string; extRedirectUri?: string }> {
  zaimRoutesLogger
    .with({ oauthToken })
    .debug("Looking up request token state from KV: {oauthToken}");

  const stored = await env.ZAIM_KV.get(`zaim:request:${oauthToken}`);
  if (!stored) {
    zaimRoutesLogger
      .with({ oauthToken })
      .warn("Request token not found or expired in KV: {oauthToken}");
    throw new Error("Request token not found or expired");
  }

  const { tokenSecret, userSub, extRedirectUri } = v.parse(
    RequestTokenStateSchema,
    JSON.parse(stored),
  );

  zaimRoutesLogger
    .with({ userSub, oauthToken })
    .debug("Request token state found for user {userSub}, starting access token exchange");

  const accessConfig = {
    consumerKey: env.ZAIM_CONSUMER_KEY,
    consumerSecret: env.ZAIM_CONSUMER_SECRET,
    token: oauthToken,
    tokenSecret,
  };

  const { oauthToken: accessToken, oauthTokenSecret } = await fetchZaimAccessToken(
    accessConfig,
    oauthVerifier,
  );

  const accessTokenConfig = {
    consumerKey: env.ZAIM_CONSUMER_KEY,
    consumerSecret: env.ZAIM_CONSUMER_SECRET,
    token: accessToken,
    tokenSecret: oauthTokenSecret,
  };

  const zaimUserId = await fetchZaimUserId(accessTokenConfig);

  zaimRoutesLogger
    .with({ userSub, zaimUserId })
    .info("Access token obtained for user {userSub} (Zaim user {zaimUserId}), saving to KV");

  const tokenData: StoredAccessToken = {
    oauthToken: accessToken,
    oauthTokenSecret,
    zaimUserId,
  };

  await env.ZAIM_KV.put(`zaim:token:${userSub}`, JSON.stringify(tokenData));
  await env.ZAIM_KV.delete(`zaim:request:${oauthToken}`);

  zaimRoutesLogger
    .with({ userSub, zaimUserId })
    .debug("Token exchange complete: access token stored, request token deleted");

  return { zaimUserId, extRedirectUri };
}

/**
 * Zaim OAuth 開始
 *
 * ext_redirect_uri が指定された場合（拡張機能フロー）:
 *   - oauth_callback は常にサーバーの /zaim/auth/callback を使用
 *   - ext_redirect_uri を KV に保存し、callback 完了後にそこへリダイレクト
 *   - JSON { authorizeUrl } を返す（拡張機能が launchWebAuthFlow に渡す用）
 *
 * ext_redirect_uri が未指定の場合（従来フロー）:
 *   - Zaim 認可画面へリダイレクト
 */
const startRoute = new Hono<HonoEnv>().get(
  "/zaim/auth/start",
  sValidator("query", StartQuerySchema, (result, c) => {
    if (!result.success) return c.json({ error: "Invalid query" }, 400);
  }),
  async (c) => {
    const auth = c.var.oidcAuth;
    if (!auth?.sub) {
      zaimRoutesLogger.warn("Zaim auth start: unauthorized (no OIDC session)");
      return c.json({ error: "Unauthorized" }, 401);
    }

    const { ext_redirect_uri } = c.req.valid("query");
    if (ext_redirect_uri !== undefined && !isValidExtensionRedirectUri(ext_redirect_uri)) {
      zaimRoutesLogger
        .with({ extRedirectUri: ext_redirect_uri })
        .warn("Zaim auth start: invalid ext_redirect_uri: {extRedirectUri}");
      return c.json({ error: "Invalid ext_redirect_uri" }, 400);
    }

    zaimRoutesLogger
      .with({ userSub: auth.sub, extFlow: ext_redirect_uri !== undefined })
      .info("Zaim auth start for user {userSub} (ext_flow={extFlow})");

    const callbackUrl = new URL("/zaim/auth/callback", c.req.url).toString();

    const { oauthToken, oauthTokenSecret } = await fetchZaimRequestToken(
      {
        consumerKey: c.env.ZAIM_CONSUMER_KEY,
        consumerSecret: c.env.ZAIM_CONSUMER_SECRET,
      },
      callbackUrl,
    );

    const state: RequestTokenState = {
      tokenSecret: oauthTokenSecret,
      userSub: auth.sub,
      extRedirectUri: ext_redirect_uri,
    };

    await c.env.ZAIM_KV.put(`zaim:request:${oauthToken}`, JSON.stringify(state), {
      expirationTtl: REQUEST_TOKEN_TTL,
    });

    zaimRoutesLogger
      .with({ oauthToken, userSub: auth.sub, ttl: REQUEST_TOKEN_TTL })
      .debug("Request token stored in KV: {oauthToken} (TTL={ttl}s)");

    const authorizeUrl = buildZaimAuthorizeUrl(oauthToken);

    if (ext_redirect_uri !== undefined) {
      zaimRoutesLogger.debug("Returning authorizeUrl for extension flow");
      return c.json({ authorizeUrl });
    }

    zaimRoutesLogger.debug("Redirecting to Zaim authorize URL");
    return c.redirect(authorizeUrl);
  },
);

/**
 * Zaim OAuth コールバック
 *
 * Zaim 認可後に oauth_token と oauth_verifier を受け取り、
 * Access Token を取得してユーザーの KV に保存する。
 *
 * 拡張機能フローの場合は extRedirectUri（chromiumapp.org）にリダイレクトし、
 * launchWebAuthFlow にフロー完了を通知する。
 */
const callbackRoute = new Hono<HonoEnv>().get(
  "/zaim/auth/callback",
  sValidator("query", CallbackQuerySchema, (result, c) => {
    if (!result.success) {
      return c.json({ error: "Missing oauth_token or oauth_verifier" }, 400);
    }
  }),
  async (c) => {
    const { oauth_token: oauthToken, oauth_verifier: oauthVerifier } = c.req.valid("query");

    zaimRoutesLogger.with({ oauthToken }).info("Zaim auth callback received: {oauthToken}");

    try {
      const { zaimUserId, extRedirectUri } = await performZaimTokenExchange(
        c.env,
        oauthToken,
        oauthVerifier,
      );

      zaimRoutesLogger
        .with({ zaimUserId, extFlow: !!extRedirectUri })
        .info("Zaim token exchange successful for Zaim user {zaimUserId}");

      if (extRedirectUri) {
        zaimRoutesLogger.debug("Redirecting to extension callback URL");
        return c.redirect(extRedirectUri);
      }

      return c.json({ ok: true, zaimUserId });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Token exchange failed";
      zaimRoutesLogger
        .with({ oauthToken, error: message })
        .error("Zaim token exchange failed: {error}");
      return c.json({ error: message }, 400);
    }
  },
);

/**
 * Zaim 連携状態確認
 * アクセストークンが保存されているかどうかを返す。
 */
const statusRoute = new Hono<HonoEnv>().get("/zaim/auth/status", async (c) => {
  const auth = c.var.oidcAuth;
  if (!auth) {
    zaimRoutesLogger.warn("Zaim auth status: unauthorized (no OIDC session)");
    return c.json({ error: "Unauthorized" }, 401);
  }

  zaimRoutesLogger
    .with({ userSub: auth.sub })
    .debug("Checking Zaim connection status for {userSub}");

  const stored = await c.env.ZAIM_KV.get(`zaim:token:${auth.sub}`);
  if (!stored) {
    zaimRoutesLogger.with({ userSub: auth.sub }).debug("Zaim not connected for {userSub}");
    return c.json({ connected: false });
  }

  const { zaimUserId } = v.parse(StoredAccessTokenSchema, JSON.parse(stored));
  zaimRoutesLogger
    .with({ userSub: auth.sub, zaimUserId })
    .debug("Zaim connected for {userSub} (Zaim user {zaimUserId})");
  return c.json({ connected: true, zaimUserId });
});

/**
 * Zaim 連携解除
 * KV に保存されたアクセストークンを削除する。
 */
const tokenRoute = new Hono<HonoEnv>().delete("/zaim/auth/token", async (c) => {
  const auth = c.var.oidcAuth;
  if (!auth) {
    zaimRoutesLogger.warn("Zaim token delete: unauthorized (no OIDC session)");
    return c.json({ error: "Unauthorized" }, 401);
  }

  zaimRoutesLogger.with({ userSub: auth.sub }).info("Deleting Zaim access token for {userSub}");
  await c.env.ZAIM_KV.delete(`zaim:token:${auth.sub}`);
  zaimRoutesLogger.with({ userSub: auth.sub }).info("Zaim access token deleted for {userSub}");
  return c.json({ ok: true });
});

export const zaimRoutes = new Hono<HonoEnv>()
  .route("/", startRoute)
  .route("/", callbackRoute)
  .route("/", statusRoute)
  .route("/", tokenRoute);

/**
 * 指定ユーザーの Zaim アクセストークンを KV から取得するヘルパー
 * 他のルートで Zaim API を呼び出す際に使用する。
 */
export async function getStoredZaimToken(
  kv: KVNamespace,
  userSub: string,
): Promise<StoredAccessToken | null> {
  const stored = await kv.get(`zaim:token:${userSub}`);
  if (!stored) return null;
  return v.parse(StoredAccessTokenSchema, JSON.parse(stored));
}
