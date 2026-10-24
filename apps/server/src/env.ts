import type { Ai, KVNamespace } from "@cloudflare/workers-types";
import type { AccessUser } from "./access.ts";
import type { Logger } from "./loggerMiddleware.ts";

/**
 * Cloudflare Workers の環境変数（バインディング）の型定義
 */
export type Env = {
  /** Zaim API の Consumer Key（Zaim Developer Console で発行） */
  ZAIM_CONSUMER_KEY: string;
  /** Zaim API の Consumer Secret（Zaim Developer Console で発行） */
  ZAIM_CONSUMER_SECRET: string;
  /**
   * Zaim OAuth のコールバックを受けるオリジン（例: https://zaim-connect-quick-zaim-server.<subdomain>.workers.dev）。
   * 未設定ならリクエストを受けたホストを使う。Zaim アプリに登録したサービスのドメインと一致させる必要がある。
   */
  ZAIM_OAUTH_CALLBACK_ORIGIN?: string;

  /** OAuth トークン等の一時・永続ステートを保持する Cloudflare KV ネームスペース */
  ZAIM_KV: KVNamespace;

  /** Cloudflare Workers AI binding（`wrangler.jsonc` の `ai.binding` で設定） */
  AI: Ai;
  /**
   * Cloudflare Access のチームドメイン（例: https://<team>.cloudflareaccess.com）。
   * ctx.access が渡らないリクエストで Cf-Access-Jwt-Assertion を検証するのに使う。
   */
  ACCESS_TEAM_DOMAIN?: string;
  /** Worker を保護している Access アプリケーションの AUD タグ（JWT の aud と照合する） */
  ACCESS_AUD?: string;

  /** Workers AI のモデル ID（例: "@cf/meta/llama-3.3-70b-instruct-fp8-fast"）。`wrangler.jsonc` の vars で設定する */
  LLM_MODEL: string;
};

/** Hono アプリ全体で共有する環境型 */
export type HonoEnv = {
  Bindings: Env;
  /** user は requireAccessUser を通ったルートでのみ設定される */
  Variables: { logger: Logger; user?: AccessUser };
};
