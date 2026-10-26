import type { Context } from "hono";
import { defineMiddleware } from "void";
import { env } from "void/env";
import { getAccessUser, getAccessUserFromJwt, type AccessUser } from "../src/access.ts";

declare module "void" {
  interface CloudContextVariables {
    /** Cloudflare Access で認証されたユーザー。このミドルウェアを通ったリクエストでは常に設定される（`user` は Void の認証機能が使う名前なので避ける） */
    accessUser: AccessUser;
  }
}

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
 * Cloudflare Access で認証済みでなければ 401 を返し、認証済みならユーザーをコンテキストに設定する。
 *
 * まず ctx.access から取り出し、取れなければ Cf-Access-Jwt-Assertion を検証する。
 * Void のデプロイ時の準備確認（/__void/*）は Access の認証情報付きで来るが、ユーザーは要らないので通す。
 */
export default defineMiddleware(async (c, next) => {
  if (c.req.path.startsWith("/__void/")) {
    await next();
    return;
  }

  const userFromContext = await getAccessUser(readExecutionCtx(c));
  if (userFromContext) {
    console.info("Access authenticated via ctx.access", { path: c.req.path });
    c.set("accessUser", userFromContext);
    await next();
    return;
  }

  const result = await getAccessUserFromJwt(
    c.req.header("Cf-Access-Jwt-Assertion"),
    env.ACCESS_AUD ? { teamDomain: env.ACCESS_TEAM_DOMAIN, aud: env.ACCESS_AUD } : undefined,
  );
  if (!result.user) {
    console.warn("Access authentication failed", { path: c.req.path, reason: result.reason });
    return c.json({ error: "Unauthorized" }, 401);
  }

  console.info("Access authenticated via Cf-Access-Jwt-Assertion", { path: c.req.path });
  c.set("accessUser", result.user);
  await next();
});
