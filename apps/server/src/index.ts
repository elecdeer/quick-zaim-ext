import { Hono } from "hono";
import { cors } from "hono/cors";
import type { HonoEnv, Env } from "./env.ts";
import "./logger.ts";
import { loggerMiddleware } from "./loggerMiddleware.ts";
import { requireAccessUser } from "./middleware.ts";
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
// ログイン・セッション管理は Worker の手前の Cloudflare Access が担う。
// Worker 側は Access が付与する ctx.access からユーザーを取り出すだけで、取れなければ 401 を返す。
// /auth/launch は Access のログインを経た後に拡張機能の chromiumapp.org へ戻すだけなのでユーザーは不要。
base.use("/me", requireAccessUser);
// /api/* は requireAccessUser で 401 を返す（Zaim クライアント生成は各ルートの requireZaimClient が担う）
base.use("/api/*", requireAccessUser);

// Zaim OAuth ルート
// /zaim/auth/start, /zaim/auth/status, /zaim/auth/token はユーザーが必要
// /zaim/auth/callback は Zaim からのリダイレクトを受け取るためユーザー不要
//   （ユーザー識別は KV に保存した AccessUser.id で行う）
base.use("/zaim/auth/start", requireAccessUser);
base.use("/zaim/auth/status", requireAccessUser);
base.use("/zaim/auth/token", requireAccessUser);

// Worker 側で認証を要求しないルート（Access の保護対象には含まれる）
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
  // Zaim データ取得（/api/zaim/*）- /api/* の requireAccessUser で保護済み
  .route("/", categoriesRoutes)
  .route("/", accountsRoutes)
  .route("/", storesRoutes)
  .route("/", paymentRoutes)
  // LLM 抽出（/api/llm/*）- /api/* の requireAccessUser で保護済み
  .route("/", llmExtractPaymentRoutes)
  .route("/", healthRoute);

export default app;
export type AppType = typeof app;
