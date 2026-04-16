import { getAuth, revokeSession } from "@hono/oidc-auth";
import { Hono } from "hono";
import type { Env } from "../env.ts";

export const authRoutes = new Hono<{ Bindings: Env }>();

/**
 * ログアウトエンドポイント
 * アプリのセッションを破棄し、Auth0側のセッションもクリアする。
 * Auth0のログアウトエンドポイントにリダイレクトすることで、
 * 次回アクセス時に別アカウントを選択できるようになる。
 */
authRoutes.get("/logout", async (c) => {
  await revokeSession(c);

  const issuer = c.env.OIDC_ISSUER.replace(/\/$/, "");
  const clientId = c.env.OIDC_CLIENT_ID;
  const returnTo = new URL("/", c.req.url).toString();
  const logoutUrl = `${issuer}/v2/logout?client_id=${clientId}&returnTo=${encodeURIComponent(returnTo)}`;

  return c.redirect(logoutUrl);
});

/**
 * ログインユーザー情報取得エンドポイント
 * 認証済みユーザーの情報をJSONで返す
 * oidcAuthMiddleware() によって認証が保証されているため auth は非 null
 */
authRoutes.get("/me", async (c) => {
  const auth = await getAuth(c);
  return c.json({
    email: auth?.email,
    sub: auth?.sub,
  });
});
