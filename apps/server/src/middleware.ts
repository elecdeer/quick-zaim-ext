import { createClient } from "@repo/zaim-api/client";
import { createZaimAuthInterceptor } from "@repo/zaim-api/oauth/interceptor";
import type { Context } from "hono";
import { createMiddleware } from "hono/factory";
import {
  getAccessUser,
  getAccessUserFromJwt,
  hasAccessContext,
  type AccessJwtConfig,
  type AccessUser,
} from "./access.ts";
import type { Env } from "./env.ts";
import type { Logger } from "./loggerMiddleware.ts";
import { getStoredZaimToken } from "./features/zaim-auth/repository.ts";
import { createZaimLoggingInterceptors } from "./zaimLoggingInterceptor.ts";

const ZAIM_API_BASE = "https://api.zaim.net";

/**
 * Hono の `c.executionCtx` は ExecutionContext が渡されていないと例外を投げるため、
 * その場合は undefined を返す（未認証として扱う）。
 */
const readExecutionCtx = (c: Context): unknown => {
  try {
    return c.executionCtx;
  } catch {
    return undefined;
  }
};

/**
 * Access JWT の検証設定を環境変数から読む。どちらかが未設定なら JWT 検証は行わない。
 */
const readAccessJwtConfig = (env: Env): AccessJwtConfig | undefined =>
  env.ACCESS_TEAM_DOMAIN && env.ACCESS_AUD
    ? { teamDomain: env.ACCESS_TEAM_DOMAIN, aud: env.ACCESS_AUD }
    : undefined;

/**
 * Cloudflare Access で認証済みでなければ 401 を返す。認証済みの場合は user をコンテキストに設定する。
 * Hono の型推論により、このミドルウェアを .use()/.get() でチェーンすると
 * 後続ハンドラで user が AccessUser（非 null）として推論される。
 *
 * まず ctx.access からユーザーを取り出し、取れなければ Cf-Access-Jwt-Assertion を検証して取り出す。
 * user がすでに設定済みの場合（テスト時のコンテキスト注入など）はどちらもスキップする。
 */
export const requireAccessUser = createMiddleware<{
  Bindings: Env;
  Variables: { user: AccessUser; logger: Logger };
}>(async (c, next) => {
  // At runtime, user may be undefined (not set yet) or null (injected as
  // unauthenticated by the test context). Distinguish to avoid reading ctx.access
  // when the value was already explicitly set.
  const existing = c.var.user as AccessUser | null | undefined;
  if (existing !== undefined) {
    if (!existing) return c.json({ error: "Unauthorized" }, 401);
    await next();
    return;
  }

  const executionCtx = readExecutionCtx(c);
  const userFromContext = await getAccessUser(executionCtx);
  if (userFromContext) {
    c.set("user", userFromContext);
    await next();
    return;
  }

  // ctx.access が使えない理由を後から追えるよう、JWT 検証に回った時点の状況を残す
  const diagnostics = {
    hasAccessContext: hasAccessContext(executionCtx),
    hasJwtHeader: c.req.header("Cf-Access-Jwt-Assertion") !== undefined,
    hasAccessEmailHeader: c.req.header("Cf-Access-Authenticated-User-Email") !== undefined,
  };
  const result = await getAccessUserFromJwt(
    c.req.header("Cf-Access-Jwt-Assertion"),
    readAccessJwtConfig(c.env),
  );
  if (!result.user) {
    c.var.logger
      .with({ ...diagnostics, reason: result.reason })
      .warn(
        "Unauthorized {path}: {reason} (ctx.access={hasAccessContext}, jwtHeader={hasJwtHeader})",
      );
    return c.json({ error: "Unauthorized" }, 401);
  }

  c.var.logger
    .with(diagnostics)
    .info(
      "ctx.access unavailable for {path} (ctx.access={hasAccessContext}); authenticated via Access JWT",
    );
  c.set("user", result.user);
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
    user: AccessUser;
    zaimClient: ReturnType<typeof createClient>;
    zaimUserId: string;
    logger: Logger;
  };
}>(async (c, next) => {
  if (c.var.zaimClient) {
    await next();
    return;
  }

  const token = await getStoredZaimToken(c.env.ZAIM_KV, c.var.user.id);
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

  // Zaim API のリクエスト・レスポンスを常にロギングする。
  // auth interceptor の後に登録することで、署名済みの最終リクエストがログ対象になる。
  const logging = createZaimLoggingInterceptors(c.var.logger);
  client.interceptors.request.use(logging.request);
  client.interceptors.response.use(logging.response);
  client.interceptors.error.use(logging.error);

  c.set("zaimClient", client);
  c.set("zaimUserId", token.zaimUserId);
  await next();
});
