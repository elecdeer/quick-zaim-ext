import type { Ai, KVNamespace } from "@cloudflare/workers-types";
import type { Logger } from "./loggerMiddleware.ts";

/**
 * Cloudflare Workers の環境変数（バインディング）の型定義
 */
export type Env = {
  /** Auth0のIssuer URL（例: https://your-tenant.auth0.com/） */
  OIDC_ISSUER: string;
  /** Auth0のClient ID */
  OIDC_CLIENT_ID: string;
  /** Auth0のClient Secret */
  OIDC_CLIENT_SECRET: string;
  /** OAuthコールバックURL（例: http://localhost:8787/callback） */
  OIDC_REDIRECT_URI: string;
  /** セッション暗号化用シークレット（32文字以上のランダム文字列） */
  OIDC_AUTH_SECRET: string;

  /** Zaim API の Consumer Key（Zaim Developer Console で発行） */
  ZAIM_CONSUMER_KEY: string;
  /** Zaim API の Consumer Secret（Zaim Developer Console で発行） */
  ZAIM_CONSUMER_SECRET: string;

  /** OAuth トークン等の一時・永続ステートを保持する Cloudflare KV ネームスペース */
  ZAIM_KV: KVNamespace;

  /** Cloudflare Workers AI binding（`wrangler.jsonc` の `ai.binding` で設定） */
  AI: Ai;
  /** Workers AI のモデル ID（例: "@cf/meta/llama-3.3-70b-instruct-fp8-fast"）。`wrangler.jsonc` の vars で設定する */
  LLM_MODEL: string;
};

/** Hono アプリ全体で共有する環境型 */
export type HonoEnv = { Bindings: Env; Variables: { logger: Logger } };
