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

/** OIDC 認証済みでなければ 401 を返す */
export const requireOidcAuth = createMiddleware<HonoEnv>(async (c, next) => {
  if (!c.var.oidcAuth?.sub) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  await next();
});

/**
 * Zaim 連携済みでなければ 403 を返す。連携済みの場合は KV からトークンを取得して
 * zaimClient / zaimUserId をコンテキストに設定してから次のハンドラへ進む。
 *
 * zaimClient がすでに設定済みの場合（テスト時のコンテキスト注入など）は KV lookup をスキップする。
 */
export const requireZaimClient = createMiddleware<HonoEnv>(async (c, next) => {
  if (c.var.zaimClient) {
    await next();
    return;
  }
  const token = await getStoredZaimToken(c.env.ZAIM_KV, c.var.oidcAuth!.sub!);
  if (!token) {
    return c.json({ error: "Zaim not connected" }, 403);
  }
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
  await next();
});
