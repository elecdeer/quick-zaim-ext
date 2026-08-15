/**
 * テスト共通フィクスチャ
 *
 * RFC 5849 Appendix A.2 テストベクターを使った決定論的 OAuth 署名テスト用に
 * nonce・タイムスタンプをモックする test.extend フィクスチャを提供する。
 */

import { test, vi } from "vite-plus/test";

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
