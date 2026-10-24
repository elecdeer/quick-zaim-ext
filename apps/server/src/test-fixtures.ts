/**
 * テスト共通フィクスチャ
 *
 * RFC 5849 Appendix A.2 テストベクターを使った決定論的 OAuth 署名テスト用に
 * nonce・タイムスタンプをモックする test.extend フィクスチャを提供する。
 */

import { type MockedFunction, test, vi } from "vite-plus/test";
import type { Ai, KVNamespace } from "@cloudflare/workers-types";
import type { createClient } from "@repo/zaim-api/client";
import { getLogger } from "@logtape/logtape";
import { Hono } from "hono";
import { sign } from "hono/jwt";
import { testClient } from "hono/testing";
import type { AccessUser } from "./access.ts";
import type { Env, HonoEnv } from "./env.ts";
import { createMiddleware } from "hono/factory";

/** RFC 5849 Appendix A.2 テストベクター */
export const RFC = {
  consumerKey: "dpf43f3p2l4k3l03",
  consumerSecret: "kd94hf93k423kf44",
  token: "nnch734d00sl2jdk",
  tokenSecret: "pfkkdhi9sl3r4s00",
  nonce: "kllo9940pd9333jh",
  timestamp: 1191242096,
  method: "GET",
  url: "http://photos.example.net/photos",
  queryParams: { file: "vacation.jpg", size: "original" },
  expectedSignature: "tR3+Ty81lMeYAr/Fid0kMTYa/WM=",
} as const;

/**
 * `OAuth key="value", ...` 形式のヘッダーをパースして
 * { key: decodedValue } のマップを返す
 */
export const parseOAuthHeader = (header: string): Record<string, string> => {
  const result: Record<string, string> = {};
  const body = header.replace(/^OAuth\s+/, "");
  for (const part of body.split(", ")) {
    const eqIdx = part.indexOf("=");
    if (eqIdx === -1) continue;
    const key = part.slice(0, eqIdx);
    const encodedValue = part.slice(eqIdx + 2, -1); // "value" → value (quotes stripped)
    result[key] = decodeURIComponent(encodedValue);
  }
  return result;
};

export interface OAuthTestFixtures {
  /** `Date.now()` を RFC タイムスタンプに固定する */
  fixedTime: void;
  /** `crypto.randomUUID()` を RFC nonce に固定する */
  mockedNonce: void;
}

export interface KVNamespaceMock {
  /** Cloudflare KV 互換オブジェクト（Env に渡す用） */
  kv: KVNamespace;
  /** get のモック関数（mockResolvedValueOnce などで制御する） */
  mockGet: MockedFunction<(key: string) => Promise<string | null>>;
  /** put のモック関数 */
  mockPut: MockedFunction<(key: string, value: string) => Promise<void>>;
  /** delete のモック関数 */
  mockDelete: MockedFunction<(key: string) => Promise<void>>;
}

/**
 * インメモリ KV ネームスペースモック
 *
 * get / put / delete のみ実装。TTL は無視する（テストでは期限切れを再現しない）。
 * 返り値の mockGet / mockPut / mockDelete を使って挙動を制御する。
 */
export const createKVNamespaceMock = (): KVNamespaceMock => {
  const store = new Map<string, string>();
  const mockGet = vi.fn(async (key: string): Promise<string | null> => store.get(key) ?? null);
  const mockPut = vi.fn(async (key: string, value: string): Promise<void> => {
    store.set(key, value);
  });
  const mockDelete = vi.fn(async (key: string): Promise<void> => {
    store.delete(key);
  });
  const kv = {
    get: mockGet,
    put: mockPut,
    delete: mockDelete,
    list: vi.fn(),
    getWithMetadata: vi.fn(),
  } as unknown as KVNamespace;
  return { kv, mockGet, mockPut, mockDelete };
};

/**
 * テスト用の Env オブジェクトを生成する。
 *
 * 必須フィールドの一覧をテストごとに繰り返さなくて済むよう共通化する。
 * 個別のテストで値を上書きしたい場合は overrides で指定する。
 */
export const createTestEnv = (overrides: Partial<Env> = {}): Env => {
  const { kv } = createKVNamespaceMock();
  // Workers AI binding は llmModel 注入のためテストでは使われない想定だが、
  // 型を満たすためダミーを置く。
  const ai = {} as unknown as Ai;
  return {
    ZAIM_CONSUMER_KEY: "zaim_consumer_key",
    ZAIM_CONSUMER_SECRET: "zaim_consumer_secret",
    ZAIM_KV: kv,
    AI: ai,
    LLM_MODEL: "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
    ...overrides,
  };
};

/** テストで注入するコンテキスト変数 */
export interface RouteTestContext {
  user?: AccessUser | null;
  zaimClient?: ReturnType<typeof createClient>;
  zaimUserId?: string;
}

/**
 * ルートテスト用クライアントファクトリ
 *
 * コンテキスト変数を直接注入するミドルウェアを挟んでから testClient を返す。
 * これにより ctx.access / createClient などのモックが不要になる。
 */
export const createTestClient = <T extends Hono<HonoEnv, any, any>>(
  route: T,
  env: Env,
  context: RouteTestContext = {},
) => {
  const base = new Hono<HonoEnv>();
  const testMiddleware = createMiddleware<{
    Variables: RouteTestContext & { logger: ReturnType<typeof getLogger> };
  }>(async (c, next) => {
    c.set("logger", getLogger(["quick-zaim", "server"]));
    if ("user" in context) c.set("user", context.user ?? null);
    if ("zaimClient" in context && context.zaimClient) c.set("zaimClient", context.zaimClient);
    if ("zaimUserId" in context && context.zaimUserId) c.set("zaimUserId", context.zaimUserId);
    await next();
  });

  base.use("*", testMiddleware);
  const app = base.route("/", route);
  return testClient(app as T, env);
};

/** Zaim API クライアントのスタブ（API 関数がモックされている前提で使用） */
export const createZaimClientStub = (): ReturnType<typeof createClient> =>
  ({
    interceptors: { request: { use: vi.fn() } },
  }) as unknown as ReturnType<typeof createClient>;

/**
 * 決定論的な OAuth 署名テスト用の拡張 test
 *
 * fixedTime: vi.useFakeTimers で RFC タイムスタンプに固定
 * mockedNonce: crypto.randomUUID を RFC nonce に固定
 */
export const oauthTest = test.extend<OAuthTestFixtures>({
  // eslint-disable-next-line no-empty-pattern
  fixedTime: async ({}, use) => {
    vi.useFakeTimers();
    vi.setSystemTime(RFC.timestamp * 1000);
    await use();
    vi.useRealTimers();
  },
  // eslint-disable-next-line no-empty-pattern
  mockedNonce: async ({}, use) => {
    // crypto.randomUUID は @cloudflare/workers-types で型が異なるため unknown 経由でキャスト
    const spy = vi
      .spyOn(crypto, "randomUUID")
      .mockReturnValue(RFC.nonce as unknown as ReturnType<typeof crypto.randomUUID>);
    await use();
    spy.mockRestore();
  },
});

/** Access JWT テストで使うチームドメインと AUD */
export const ACCESS_TEST_CONFIG = {
  teamDomain: "https://test-team.cloudflareaccess.com",
  aud: "test-aud",
} as const;

/**
 * Cloudflare Access の JWT を模した RS256 トークンを発行するテスト用の署名器を作る。
 *
 * `jwks` を Access の certs エンドポイントのレスポンスとして返せば、本物と同じ経路で署名を検証できる。
 */
export const createAccessJwtSigner = async (kid = "test-kid") => {
  const keyPair = await crypto.subtle.generateKey(
    {
      name: "RSASSA-PKCS1-v1_5",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["sign", "verify"],
  );
  // workers-types の generateKey / exportKey は戻り値が共用体なので、型ガードで絞り込む
  if (!("privateKey" in keyPair)) throw new Error("RSA key generation did not return a key pair");
  const exportJwk = async (key: CryptoKey) => {
    const jwk = await crypto.subtle.exportKey("jwk", key);
    if (jwk instanceof ArrayBuffer) throw new Error("expected a JWK export");
    return { ...jwk, kid, alg: "RS256" };
  };
  const privateJwk = await exportJwk(keyPair.privateKey);
  const publicJwk = await exportJwk(keyPair.publicKey);
  const now = Math.floor(Date.now() / 1000);

  return {
    jwks: { keys: [publicJwk] },
    /** 既定では有効な Access JWT を発行し、claims で上書きできる */
    sign: (claims: Record<string, unknown> = {}) =>
      sign(
        {
          iss: ACCESS_TEST_CONFIG.teamDomain,
          aud: [ACCESS_TEST_CONFIG.aud],
          email: "user@example.com",
          iat: now,
          nbf: now,
          exp: now + 3600,
          ...claims,
        },
        privateJwk,
      ),
  };
};
