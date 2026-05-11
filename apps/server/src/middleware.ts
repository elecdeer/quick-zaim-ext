import { getAuth } from "@hono/oidc-auth";
import { createClient } from "@repo/zaim-api/client";
import { createZaimAuthInterceptor } from "@repo/zaim-api/oauth/interceptor";
import { createMiddleware } from "hono/factory";
import type { HonoEnv } from "./env.ts";
import { getStoredZaimToken } from "./routes/zaim.ts";

const ZAIM_API_BASE = "https://api.zaim.net";

/** OIDC セッションからユーザー情報を取り出してコンテキスト変数に設定する */
export const setOidcAuthMiddleware = createMiddleware<HonoEnv>(async (c, next) => {
  c.set("oidcAuth", await getAuth(c));
  await next();
});

/**
 * Zaim API クライアントを生成してコンテキスト変数に設定する
 *
 * oidcAuth が未設定またはトークン未連携の場合はスキップ（変数は undefined のまま）。
 */
export const setZaimClientMiddleware = createMiddleware<HonoEnv>(async (c, next) => {
  const auth = c.var.oidcAuth;
  if (auth?.sub) {
    const token = await getStoredZaimToken(c.env.ZAIM_KV, auth.sub);
    if (token) {
      const client = createClient({ baseUrl: ZAIM_API_BASE });
      client.interceptors.request.use(
        createZaimAuthInterceptor({
          consumerKey: c.env.ZAIM_CONSUMER_KEY,
          consumerSecret: c.env.ZAIM_CONSUMER_SECRET,
          token: token.oauthToken,
          tokenSecret: token.oauthTokenSecret,
        }),
      );
      c.set("zaimClient", client);
      c.set("zaimUserId", token.zaimUserId);
    }
  }
  await next();
});

/** OIDC 認証済みでなければ 401 を返す */
export const requireOidcAuth = createMiddleware<HonoEnv>(async (c, next) => {
  if (!c.var.oidcAuth?.sub) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  await next();
});

/** Zaim 連携済みでなければ 403 を返す */
export const requireZaimClient = createMiddleware<HonoEnv>(async (c, next) => {
  if (!c.var.zaimClient) {
    return c.json({ error: "Zaim not connected" }, 403);
  }
  await next();
});
