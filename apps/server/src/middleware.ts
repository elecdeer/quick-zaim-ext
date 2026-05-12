import { getAuth, type OidcAuth } from "@hono/oidc-auth";
import { createClient } from "@repo/zaim-api/client";
import { createZaimAuthInterceptor } from "@repo/zaim-api/oauth/interceptor";
import { createMiddleware } from "hono/factory";
import type { Env } from "./env.ts";
import { getStoredZaimToken } from "./routes/zaim.ts";

const ZAIM_API_BASE = "https://api.zaim.net";

/**
 * OIDC 認証済みでなければ 401 を返す。認証済みの場合は oidcAuth をコンテキストに設定する。
 * Hono の型推論により、このミドルウェアを .use()/.get() でチェーンすると
 * 後続ハンドラで oidcAuth が OidcAuth（非 null）として推論される。
 *
 * oidcAuth がすでに設定済みの場合（テスト時のコンテキスト注入など）は getAuth() 呼び出しをスキップする。
 */
export const requireOidcAuth = createMiddleware<{
  Variables: { oidcAuth: OidcAuth };
}>(async (c, next) => {
  if (c.var.oidcAuth) {
    await next();
    return;
  }

  const auth = await getAuth(c);
  if (!auth?.sub) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  c.set("oidcAuth", auth);
  await next();
});

/**
 * Zaim 連携済みでなければ 403 を返す。連携済みの場合は KV からトークンを取得して
 * zaimClient / zaimUserId をコンテキストに設定してから次のハンドラへ進む。
 *
 * Hono の型推論により、このミドルウェアを .use()/.get() でチェーンすると
 * 後続ハンドラで zaimClient / zaimUserId が非 optional として推論される。
 *
 * zaimClient がすでに設定済みの場合（テスト時のコンテキスト注入など）は KV lookup をスキップする。
 */
export const requireZaimClient = createMiddleware<{
  Bindings: Env;
  Variables: {
    oidcAuth: OidcAuth;
    zaimClient: ReturnType<typeof createClient>;
    zaimUserId: string;
  };
}>(async (c, next) => {
  if (c.var.zaimClient) {
    await next();
    return;
  }

  const token = await getStoredZaimToken(c.env.ZAIM_KV, c.var.oidcAuth.sub as string);
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
