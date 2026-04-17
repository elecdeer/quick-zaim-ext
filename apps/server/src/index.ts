import { oidcAuthMiddleware } from "@hono/oidc-auth";
import { honoLogger } from "@logtape/hono";
import { Hono } from "hono";
import type { Env } from "./env.ts";
import "./logger.ts";
import { authRoutes } from "./routes/auth.ts";

const app = new Hono<{ Bindings: Env }>();

app.use(honoLogger({ category: ["quick-zaim", "server"] }));

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
