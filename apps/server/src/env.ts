import type { KVNamespace } from "@cloudflare/workers-types";
import type { OidcAuth } from "@hono/oidc-auth";
import type { createClient } from "@repo/zaim-api/client";

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
};

/** Hono コンテキスト変数の型定義 */
export type Variables = {
  /** OIDC 認証済みユーザー情報（未認証時は null） */
  oidcAuth: OidcAuth | null;
  /** Zaim API クライアント（/api/zaim/* のみ設定） */
  zaimClient?: ReturnType<typeof createClient>;
  /** Zaim ユーザー ID（zaimClient と同時に設定） */
  zaimUserId?: string;
};

/** Hono アプリ全体で共有する環境型 */
export type HonoEnv = { Bindings: Env; Variables: Variables };
