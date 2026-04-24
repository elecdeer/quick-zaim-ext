import { oidcAuthMiddleware } from "@hono/oidc-auth";
import { honoLogger } from "@logtape/hono";
import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Env } from "./env.ts";
import "./logger.ts";
import { authRoutes } from "./routes/auth.ts";
import { zaimRoutes } from "./routes/zaim.ts";

const base = new Hono<{ Bindings: Env }>();

base.use(honoLogger({ category: ["quick-zaim", "server"] }));

// Chrome拡張機能・ローカル開発からのクロスオリジンリクエストを許可
base.use(
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

// 認証ミドルウェアをルートハンドラより前に登録する（Honoは登録順にマッチするため）
// /callback は oidcAuthMiddleware() 内部で OIDC_REDIRECT_URI と照合して自動処理する
base.use("/callback", oidcAuthMiddleware());
base.use("/me", oidcAuthMiddleware());
base.use("/api/*", oidcAuthMiddleware());

// Zaim OAuth ルート
// /zaim/auth/start, /zaim/auth/status, /zaim/auth/token は OIDC 認証が必要
// /zaim/auth/callback は Zaim からのリダイレクトを受け取るため OIDC 不要
//   （ユーザー識別は KV に保存した OIDC sub で行う）
base.use("/zaim/auth/start", oidcAuthMiddleware());
base.use("/zaim/auth/status", oidcAuthMiddleware());
base.use("/zaim/auth/token", oidcAuthMiddleware());

// 公開ルート（認証不要）
const rootRoute = new Hono<{ Bindings: Env }>().get("/", (c) => c.text("Hello World!"));
const healthRoute = new Hono<{ Bindings: Env }>().get("/api/health", (c) =>
  c.json({ status: "ok" }),
);

// ルートを集約して AppType に正確なスキーマ型を持たせる
const app = base
  .route("/", rootRoute)
  // 認証関連ルート（/logout, /me）
  .route("/", authRoutes)
  // Zaim OAuth フロー（/zaim/auth/*）
  .route("/", zaimRoutes)
  .route("/", healthRoute);

export default app;
export type AppType = typeof app;
