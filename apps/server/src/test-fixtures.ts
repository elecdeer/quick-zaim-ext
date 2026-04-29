/**
 * テスト共通フィクスチャ
 *
 * RFC 5849 Appendix A.2 テストベクターを使った決定論的 OAuth 署名テスト用に
 * nonce・タイムスタンプをモックする test.extend フィクスチャを提供する。
 */

import { type MockedFunction, test, vi } from "vite-plus/test";
import type { KVNamespace } from "@cloudflare/workers-types";

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
export function parseOAuthHeader(header: string): Record<string, string> {
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
}

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
export function createKVNamespaceMock(): KVNamespaceMock {
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
}

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
