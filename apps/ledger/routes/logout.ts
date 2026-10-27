import { defineHandler } from "void";

/**
 * ログアウト。セッションは Cloudflare Access の CF_Authorization Cookie なので、Access のログアウトへ送って破棄させる。
 */
export const GET = defineHandler((c) =>
  c.redirect(new URL("/cdn-cgi/access/logout", c.req.url).toString()),
);
