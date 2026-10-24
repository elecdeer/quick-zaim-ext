import { sValidator } from "@hono/standard-validator";
import { Hono } from "hono";
import * as v from "valibot";
import type { HonoEnv } from "../../env.ts";

const isValidExtensionRedirectUri = (uri: string): boolean => {
  try {
    const url = new URL(uri);
    return url.protocol === "https:" && url.hostname.endsWith(".chromiumapp.org");
  } catch {
    return false;
  }
};

/**
 * ログアウトエンドポイント
 *
 * セッションは Cloudflare Access が CF_Authorization Cookie で管理しているため、
 * Access のログアウトエンドポイントへリダイレクトして破棄させる。
 */
const logoutRoute = new Hono<HonoEnv>().get("/logout", async (c) => {
  c.var.logger.info("Logout requested, redirecting to Cloudflare Access logout");
  return c.redirect(new URL("/cdn-cgi/access/logout", c.req.url).toString());
});

/**
 * ログインユーザー情報取得エンドポイント
 */
const meRoute = new Hono<HonoEnv>().get("/me", async (c) => {
  const user = c.var.user;
  c.var.logger
    .with({ email: user?.email, userId: user?.id })
    .info("User info requested for {email}");
  return c.json({
    email: user?.email,
    id: user?.id,
  });
});

const LaunchQuerySchema = v.object({ redirect_uri: v.string() });

/**
 * 拡張機能向け認証起動エンドポイント
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
