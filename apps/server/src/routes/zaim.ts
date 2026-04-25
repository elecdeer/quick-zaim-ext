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
import { getAuth } from "@hono/oidc-auth";
import { Hono } from "hono";
import * as v from "valibot";
import type { Env } from "../env.ts";
import {
  buildZaimAuthorizeUrl,
  fetchZaimAccessToken,
  fetchZaimRequestToken,
  fetchZaimUserId,
} from "../zaim-oauth.ts";

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
  const stored = await env.ZAIM_KV.get(`zaim:request:${oauthToken}`);
  if (!stored) {
    throw new Error("Request token not found or expired");
  }

  const { tokenSecret, userSub, extRedirectUri } = v.parse(
    RequestTokenStateSchema,
    JSON.parse(stored),
  );

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

  const tokenData: StoredAccessToken = {
    oauthToken: accessToken,
    oauthTokenSecret,
    zaimUserId,
  };

  await env.ZAIM_KV.put(`zaim:token:${userSub}`, JSON.stringify(tokenData));
  await env.ZAIM_KV.delete(`zaim:request:${oauthToken}`);

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
const startRoute = new Hono<{ Bindings: Env }>().get(
  "/zaim/auth/start",
  sValidator("query", StartQuerySchema, (result, c) => {
    if (!result.success) return c.json({ error: "Invalid query" }, 400);
  }),
  async (c) => {
    const auth = await getAuth(c);
    if (!auth?.sub) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const { ext_redirect_uri } = c.req.valid("query");
    if (ext_redirect_uri !== undefined && !isValidExtensionRedirectUri(ext_redirect_uri)) {
      return c.json({ error: "Invalid ext_redirect_uri" }, 400);
    }

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

    const authorizeUrl = buildZaimAuthorizeUrl(oauthToken);

    if (ext_redirect_uri !== undefined) {
      return c.json({ authorizeUrl });
    }

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
const callbackRoute = new Hono<{ Bindings: Env }>().get(
  "/zaim/auth/callback",
  sValidator("query", CallbackQuerySchema, (result, c) => {
    if (!result.success) {
      return c.json({ error: "Missing oauth_token or oauth_verifier" }, 400);
    }
  }),
  async (c) => {
    const { oauth_token: oauthToken, oauth_verifier: oauthVerifier } = c.req.valid("query");

    try {
      const { zaimUserId, extRedirectUri } = await performZaimTokenExchange(
        c.env,
        oauthToken,
        oauthVerifier,
      );

      if (extRedirectUri) {
        return c.redirect(extRedirectUri);
      }

      return c.json({ ok: true, zaimUserId });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Token exchange failed";
      return c.json({ error: message }, 400);
    }
  },
);

/**
 * Zaim 連携状態確認
 * アクセストークンが保存されているかどうかを返す。
 */
const statusRoute = new Hono<{ Bindings: Env }>().get("/zaim/auth/status", async (c) => {
  const auth = await getAuth(c);
  if (!auth) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const stored = await c.env.ZAIM_KV.get(`zaim:token:${auth.sub}`);
  if (!stored) {
    return c.json({ connected: false });
  }

  const { zaimUserId } = v.parse(StoredAccessTokenSchema, JSON.parse(stored));
  return c.json({ connected: true, zaimUserId });
});

/**
 * Zaim 連携解除
 * KV に保存されたアクセストークンを削除する。
 */
const tokenRoute = new Hono<{ Bindings: Env }>().delete("/zaim/auth/token", async (c) => {
  const auth = await getAuth(c);
  if (!auth) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  await c.env.ZAIM_KV.delete(`zaim:token:${auth.sub}`);
  return c.json({ ok: true });
});

export const zaimRoutes = new Hono<{ Bindings: Env }>()
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
