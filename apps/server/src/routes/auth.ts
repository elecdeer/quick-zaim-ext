import { sValidator } from "@hono/standard-validator";
import { revokeSession } from "@hono/oidc-auth";
import { Hono } from "hono";
import * as v from "valibot";
import type { HonoEnv } from "../env.ts";

function isValidExtensionRedirectUri(uri: string): boolean {
  try {
    const url = new URL(uri);
    return url.protocol === "https:" && url.hostname.endsWith(".chromiumapp.org");
  } catch {
    return false;
  }
}

/**
 * ログアウトエンドポイント
 * アプリのセッションを破棄し、Auth0側のセッションもクリアする。
 * Auth0のログアウトエンドポイントにリダイレクトすることで、
 * 次回アクセス時に別アカウントを選択できるようになる。
 */
const logoutRoute = new Hono<HonoEnv>().get("/logout", async (c) => {
  const logger = c.var.logger;
  logger.info("Logout requested");

  await revokeSession(c);

  const issuer = c.env.OIDC_ISSUER.replace(/\/$/, "");
  const clientId = c.env.OIDC_CLIENT_ID;
  const returnTo = new URL("/", c.req.url).toString();
  const logoutUrl = `${issuer}/v2/logout?client_id=${clientId}&returnTo=${encodeURIComponent(returnTo)}`;

  logger.info("Session revoked, redirecting to Auth0 logout");
  return c.redirect(logoutUrl);
});

/**
 * ログインユーザー情報取得エンドポイント
 * 認証済みユーザーの情報をJSONで返す
 * oidcAuthMiddleware() によって認証が保証されているため auth は非 null
 */
const meRoute = new Hono<HonoEnv>().get("/me", async (c) => {
  const auth = c.var.oidcAuth;
  c.var.logger.with({ email: auth?.email, sub: auth?.sub }).info("User info requested for {email}");
  return c.json({
    email: auth?.email,
    sub: auth?.sub,
  });
});

const LaunchQuerySchema = v.object({ redirect_uri: v.string() });

/**
 * 拡張機能向け認証起動エンドポイント
 * chrome.identity.launchWebAuthFlow からアクセスされる。
 * OIDC 認証完了後、redirect_uri（chromiumapp.org）にリダイレクトして
 * launchWebAuthFlow にフロー完了を通知する。
 */
const launchRoute = new Hono<HonoEnv>().get(
  "/auth/launch",
  sValidator("query", LaunchQuerySchema, (result, c) => {
    if (!result.success) return c.json({ error: "Missing redirect_uri" }, 400);
  }),
  async (c) => {
    const logger = c.var.logger;
    const { redirect_uri } = c.req.valid("query");
    if (!isValidExtensionRedirectUri(redirect_uri)) {
      logger
        .with({ redirectUri: redirect_uri })
        .warn("Extension auth launch: invalid redirect_uri: {redirectUri}");
      return c.json({ error: "Invalid redirect_uri" }, 400);
    }
    logger
      .with({ redirectUri: redirect_uri })
      .info("Extension auth launch: redirecting to {redirectUri}");
    return c.redirect(redirect_uri);
  },
);

export const authRoutes = new Hono<HonoEnv>()
  .route("/", logoutRoute)
  .route("/", meRoute)
  .route("/", launchRoute);
