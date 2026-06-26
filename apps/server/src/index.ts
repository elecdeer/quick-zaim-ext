import { oidcAuthMiddleware } from "@hono/oidc-auth";
import { Hono } from "hono";
import { cors } from "hono/cors";
import type { HonoEnv, Env } from "./env.ts";
import "./logger.ts";
import { loggerMiddleware } from "./loggerMiddleware.ts";
import { requireOidcAuth } from "./middleware.ts";
import { authRoutes } from "./features/auth/index.ts";
import { accountsRoutes } from "./features/accounts/index.ts";
import { categoriesRoutes } from "./features/categories/index.ts";
import { llmExtractPaymentRoutes } from "./features/llm/index.ts";
import { storesRoutes } from "./features/stores/index.ts";
import { paymentRoutes } from "./features/payment/index.ts";
import { zaimRoutes } from "./features/zaim-auth/index.ts";

const base = new Hono<HonoEnv>();

base.use(loggerMiddleware);

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
// OAuth フローを駆動する 2 つのエンドポイントだけ oidcAuthMiddleware() を付ける。
// API 系ルート（/me, /api/*, /zaim/auth/*）に oidcAuthMiddleware() を付けると、
// 未認証時にそれぞれが Auth0 へのリダイレクト応答と一緒に state Cookie を発行してしまい、
// SidePanel 側が並列で複数の API を叩くと state Cookie が次々と上書きされ、
// /auth/launch がセットした state と Auth0 から戻る state がズレて /callback が
// "unexpected state response parameter value" で 500 になる。
// API 系は requireOidcAuth のみにして未認証なら 401 を返す。
base.use("/callback", oidcAuthMiddleware());
base.use("/auth/launch", oidcAuthMiddleware());

base.use("/me", requireOidcAuth);
// /api/* は requireOidcAuth で 401 を返す（Zaim クライアント生成は各ルートの requireZaimClient が担う）
base.use("/api/*", requireOidcAuth);

// Zaim OAuth ルート
// /zaim/auth/start, /zaim/auth/status, /zaim/auth/token は OIDC 認証が必要
// /zaim/auth/callback は Zaim からのリダイレクトを受け取るため OIDC 不要
//   （ユーザー識別は KV に保存した OIDC sub で行う）
base.use("/zaim/auth/start", requireOidcAuth);
base.use("/zaim/auth/status", requireOidcAuth);
base.use("/zaim/auth/token", requireOidcAuth);

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
  // Zaim データ取得（/api/zaim/*）- /api/* の OIDC ミドルウェアで保護済み
  .route("/", categoriesRoutes)
  .route("/", accountsRoutes)
  .route("/", storesRoutes)
  .route("/", paymentRoutes)
  // LLM 抽出（/api/llm/*）- /api/* の OIDC ミドルウェアで保護済み
  .route("/", llmExtractPaymentRoutes)
  .route("/", healthRoute);

export default app;
export type AppType = typeof app;
