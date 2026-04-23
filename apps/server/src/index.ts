import { oidcAuthMiddleware } from "@hono/oidc-auth";
import { honoLogger } from "@logtape/hono";
import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Env } from "./env.ts";
import "./logger.ts";
import { authRoutes } from "./routes/auth.ts";
import { zaimRoutes } from "./routes/zaim.ts";

const app = new Hono<{ Bindings: Env }>();

app.use(honoLogger({ category: ["quick-zaim", "server"] }));

// Chrome拡張機能・ローカル開発からのクロスオリジンリクエストを許可
app.use(
  cors({
    origin: (origin) => {
      if (!origin) return null;
      if (
        origin.startsWith("chrome-extension://") ||
        origin.startsWith("http://localhost") ||
        origin.startsWith("http://127.0.0.1")
      ) {
        return origin;
      }
      return null;
    },
    credentials: true,
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
  }),
);

// 公開ルート（認証不要）
app.get("/", (c) => c.text("Hello World!"));

// 認証ミドルウェアをルートハンドラより前に登録する（Honoは登録順にマッチするため）
// /callback は oidcAuthMiddleware() 内部で OIDC_REDIRECT_URI と照合して自動処理する
app.use("/callback", oidcAuthMiddleware());
app.use("/me", oidcAuthMiddleware());
app.use("/api/*", oidcAuthMiddleware());

// Zaim OAuth ルート
// /zaim/auth/start, /zaim/auth/status, /zaim/auth/token は OIDC 認証が必要
// /zaim/auth/callback は Zaim からのリダイレクトを受け取るため OIDC 不要
//   （ユーザー識別は KV に保存した OIDC sub で行う）
app.use("/zaim/auth/start", oidcAuthMiddleware());
app.use("/zaim/auth/status", oidcAuthMiddleware());
app.use("/zaim/auth/token", oidcAuthMiddleware());

// 認証関連ルート（/logout, /me）
app.route("/", authRoutes);

// Zaim OAuth フロー（/zaim/auth/*）
app.route("/", zaimRoutes);

app.get("/api/health", (c) => c.json({ status: "ok" }));

export default app;
