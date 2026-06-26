/**
 * Zaim OAuth 1.0a 認可フロー用ルート
 *
 * エンドポイント一覧:
 *   GET    /zaim/auth/start    - Zaim OAuth 開始
 *   GET    /zaim/auth/callback - Zaim からのコールバック
 *   GET    /zaim/auth/status   - Zaim 連携状態確認
 *   DELETE /zaim/auth/token    - Zaim 連携解除
 */

import { sValidator } from "@hono/standard-validator";
import { Hono } from "hono";
import type { HonoEnv } from "../../env.ts";
import { buildZaimAuthorizeUrl, fetchZaimRequestToken } from "../../zaim-oauth.ts";
import { CallbackQuerySchema, StartQuerySchema } from "./schema.ts";
import type { RequestTokenState } from "./schema.ts";
import { getStoredZaimToken, saveRequestTokenState, deleteAccessToken } from "./repository.ts";
import { performZaimTokenExchange } from "./service.ts";

/** Request Token の有効期限（秒） */
const REQUEST_TOKEN_TTL = 600;

const isValidExtensionRedirectUri = (uri: string): boolean => {
  try {
    const url = new URL(uri);
    return url.protocol === "https:" && url.hostname.endsWith(".chromiumapp.org");
  } catch {
    return false;
  }
};

/**
 * Zaim OAuth 開始
 */
const startRoute = new Hono<HonoEnv>().get(
  "/zaim/auth/start",
  sValidator("query", StartQuerySchema, (result, c) => {
    if (!result.success) return c.json({ error: "Invalid query" }, 400);
  }),
  async (c) => {
    const logger = c.var.logger;
    const auth = c.var.oidcAuth;
    if (!auth?.sub) {
      logger.warn("Zaim auth start: unauthorized (no OIDC session)");
      return c.json({ error: "Unauthorized" }, 401);
    }

    const { ext_redirect_uri } = c.req.valid("query");
    if (ext_redirect_uri !== undefined && !isValidExtensionRedirectUri(ext_redirect_uri)) {
      logger
        .with({ extRedirectUri: ext_redirect_uri })
        .warn("Zaim auth start: invalid ext_redirect_uri: {extRedirectUri}");
      return c.json({ error: "Invalid ext_redirect_uri" }, 400);
    }

    logger
      .with({ userSub: auth.sub, extFlow: ext_redirect_uri !== undefined })
      .info("Zaim auth start for user {userSub} (ext_flow={extFlow})");

    const callbackUrl = new URL("/zaim/auth/callback", c.req.url).toString();

    const { oauthToken, oauthTokenSecret } = await fetchZaimRequestToken(
      {
        consumerKey: c.env.ZAIM_CONSUMER_KEY,
        consumerSecret: c.env.ZAIM_CONSUMER_SECRET,
      },
      callbackUrl,
      logger,
    );

    const state: RequestTokenState = {
      tokenSecret: oauthTokenSecret,
      userSub: auth.sub,
      extRedirectUri: ext_redirect_uri,
    };

    await saveRequestTokenState(c.env.ZAIM_KV, oauthToken, state, REQUEST_TOKEN_TTL);

    logger
      .with({ oauthToken, userSub: auth.sub, ttl: REQUEST_TOKEN_TTL })
      .debug("Request token stored in KV: {oauthToken} (TTL={ttl}s)");

    const authorizeUrl = buildZaimAuthorizeUrl(oauthToken);

    if (ext_redirect_uri !== undefined) {
      logger.debug("Returning authorizeUrl for extension flow");
      return c.json({ authorizeUrl });
    }

    logger.debug("Redirecting to Zaim authorize URL");
    return c.redirect(authorizeUrl);
  },
);

/**
 * Zaim OAuth コールバック
 */
const callbackRoute = new Hono<HonoEnv>().get(
  "/zaim/auth/callback",
  sValidator("query", CallbackQuerySchema, (result, c) => {
    if (!result.success) {
      return c.json({ error: "Missing oauth_token or oauth_verifier" }, 400);
    }
  }),
  async (c) => {
    const logger = c.var.logger;
    const { oauth_token: oauthToken, oauth_verifier: oauthVerifier } = c.req.valid("query");

    logger.with({ oauthToken }).info("Zaim auth callback received: {oauthToken}");

    try {
      const { zaimUserId, extRedirectUri } = await performZaimTokenExchange(
        c.env,
        oauthToken,
        oauthVerifier,
        logger,
      );

      logger
        .with({ zaimUserId, extFlow: !!extRedirectUri })
        .info("Zaim token exchange successful for Zaim user {zaimUserId}");

      if (extRedirectUri) {
        logger.debug("Redirecting to extension callback URL");
        return c.redirect(extRedirectUri);
      }

      return c.json({ ok: true, zaimUserId });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Token exchange failed";
      logger.with({ oauthToken, error: message }).error("Zaim token exchange failed: {error}");
      return c.json({ error: message }, 400);
    }
  },
);

/**
 * Zaim 連携状態確認
 */
const statusRoute = new Hono<HonoEnv>().get("/zaim/auth/status", async (c) => {
  const logger = c.var.logger;
  const auth = c.var.oidcAuth;
  if (!auth) {
    logger.warn("Zaim auth status: unauthorized (no OIDC session)");
    return c.json({ error: "Unauthorized" }, 401);
  }

  logger.with({ userSub: auth.sub }).debug("Checking Zaim connection status for {userSub}");

  const stored = await getStoredZaimToken(c.env.ZAIM_KV, auth.sub as string);
  if (!stored) {
    logger.with({ userSub: auth.sub }).debug("Zaim not connected for {userSub}");
    return c.json({ connected: false });
  }

  logger
    .with({ userSub: auth.sub, zaimUserId: stored.zaimUserId })
    .debug("Zaim connected for {userSub} (Zaim user {zaimUserId})");
  return c.json({ connected: true, zaimUserId: stored.zaimUserId });
});

/**
 * Zaim 連携解除
 */
const tokenRoute = new Hono<HonoEnv>().delete("/zaim/auth/token", async (c) => {
  const logger = c.var.logger;
  const auth = c.var.oidcAuth;
  if (!auth) {
    logger.warn("Zaim token delete: unauthorized (no OIDC session)");
    return c.json({ error: "Unauthorized" }, 401);
  }

  logger.with({ userSub: auth.sub }).info("Deleting Zaim access token for {userSub}");
  await deleteAccessToken(c.env.ZAIM_KV, auth.sub as string);
  logger.with({ userSub: auth.sub }).info("Zaim access token deleted for {userSub}");
  return c.json({ ok: true });
});

export const zaimRoutes = new Hono<HonoEnv>()
  .route("/", startRoute)
  .route("/", callbackRoute)
  .route("/", statusRoute)
  .route("/", tokenRoute);
