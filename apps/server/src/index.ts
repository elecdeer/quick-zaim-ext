import { oidcAuthMiddleware } from "@hono/oidc-auth";
import { Hono } from "hono";
import type { Env } from "./env.ts";
import { serverLogger } from "./logger.ts";
import { authRoutes } from "./routes/auth.ts";

const app = new Hono<{ Bindings: Env }>();

// リクエストロギングミドルウェア
app.use("*", async (c, next) => {
  const requestId = crypto.randomUUID();
  const start = Date.now();
  const { method } = c.req;
  const path = new URL(c.req.url).pathname;

  const logger = serverLogger.with({ requestId, method, path });
  logger.info("Request started: {method} {path}", { method, path });

  await next();

  const durationMs = Date.now() - start;
  const status = c.res.status;

  logger.with({ status, durationMs }).info("{method} {path} -> {status} ({durationMs}ms)", {
    method,
    path,
    status,
    durationMs,
  });
});

// 公開ルート（認証不要）
app.get("/", (c) => c.text("Hello World!"));

// 認証ミドルウェアをルートハンドラより前に登録する（Honoは登録順にマッチするため）
// /callback は oidcAuthMiddleware() 内部で OIDC_REDIRECT_URI と照合して自動処理する
app.use("/callback", oidcAuthMiddleware());
app.use("/me", oidcAuthMiddleware());
app.use("/api/*", oidcAuthMiddleware());

// 認証関連ルート（/logout, /me）
app.route("/", authRoutes);

app.get("/api/health", (c) => c.json({ status: "ok" }));

export default app;
