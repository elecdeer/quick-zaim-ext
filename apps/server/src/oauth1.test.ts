/**
 * OAuth 1.0a 実装のテスト
 *
 * 署名の正確性検証には RFC 5849 Appendix A.2 のテストベクターを使用する。
 *   Consumer Key:    dpf43f3p2l4k3l03
 *   Consumer Secret: kd94hf93k423kf44
 *   Token:           nnch734d00sl2jdk
 *   Token Secret:    pfkkdhi9sl3r4s00
 *   Nonce:           kllo9940pd9333jh
 *   Timestamp:       1191242096
 *   Expected sig:    tR3+Ty81lMeYAr/Fid0kMTYa/WM=
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import {
  buildZaimApiAuthHeader,
  buildZaimAuthorizeUrl,
  fetchZaimAccessToken,
  fetchZaimRequestToken,
} from "./oauth1.ts";

// RFC 5849 Appendix A.2 テストベクター
const RFC = {
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
function parseOAuthHeader(header: string): Record<string, string> {
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

function mockNonce(nonce: string) {
  // crypto.randomUUID は @cloudflare/workers-types で型が異なるため unknown 経由でキャスト
  vi.spyOn(crypto, "randomUUID").mockReturnValue(
    nonce as unknown as ReturnType<typeof crypto.randomUUID>,
  );
}

// ─────────────────────────────────────────────────────────────────────────────

describe("buildZaimAuthorizeUrl", () => {
  it("認可URLにoauth_tokenクエリパラメータを付与する", () => {
    expect(buildZaimAuthorizeUrl("mytoken123")).toBe(
      "https://auth.zaim.net/users/auth?oauth_token=mytoken123",
    );
  });

  it("oauth_tokenに含まれる特殊文字をパーセントエンコードする", () => {
    const url = buildZaimAuthorizeUrl("token+with/special=chars");
    expect(url).toBe("https://auth.zaim.net/users/auth?oauth_token=token%2Bwith%2Fspecial%3Dchars");
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("buildZaimApiAuthHeader", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(RFC.timestamp * 1000);
    mockNonce(RFC.nonce);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("'OAuth ' で始まるAuthorizationヘッダーを返す", async () => {
    const header = await buildZaimApiAuthHeader(
      { consumerKey: "key", consumerSecret: "secret" },
      "GET",
      "https://api.zaim.net/v2/home/user",
    );
    expect(header).toMatch(/^OAuth /);
  });

  it("必須OAuthパラメータをすべてヘッダーに含む", async () => {
    const header = await buildZaimApiAuthHeader(
      { consumerKey: "mykey", consumerSecret: "mysecret" },
      "GET",
      "https://api.zaim.net/v2/home/user",
    );
    const params = parseOAuthHeader(header);

    expect(params).toMatchObject({
      oauth_consumer_key: "mykey",
      oauth_nonce: RFC.nonce,
      oauth_signature_method: "HMAC-SHA1",
      oauth_timestamp: String(RFC.timestamp),
      oauth_version: "1.0",
    });
    expect(params.oauth_signature).toBeTruthy();
  });

  it("アクセストークンがある場合はoauth_tokenを含む", async () => {
    const header = await buildZaimApiAuthHeader(
      {
        consumerKey: "key",
        consumerSecret: "secret",
        token: "myaccesstoken",
        tokenSecret: "mytokensecret",
      },
      "GET",
      "https://api.zaim.net/v2/home/user",
    );
    expect(parseOAuthHeader(header).oauth_token).toBe("myaccesstoken");
  });

  it("アクセストークンがない場合はoauth_tokenを含まない", async () => {
    const header = await buildZaimApiAuthHeader(
      { consumerKey: "key", consumerSecret: "secret" },
      "GET",
      "https://api.zaim.net/v2/home/user",
    );
    expect(parseOAuthHeader(header).oauth_token).toBeUndefined();
  });

  it("クエリパラメータが異なれば署名も異なる", async () => {
    const withParams = await buildZaimApiAuthHeader(
      { consumerKey: "key", consumerSecret: "secret" },
      "GET",
      "https://api.zaim.net/v2/home/money",
      { mode: "payment" },
    );
    const withoutParams = await buildZaimApiAuthHeader(
      { consumerKey: "key", consumerSecret: "secret" },
      "GET",
      "https://api.zaim.net/v2/home/money",
    );
    expect(parseOAuthHeader(withParams).oauth_signature).not.toBe(
      parseOAuthHeader(withoutParams).oauth_signature,
    );
  });

  /**
   * RFC 5849 Appendix A.2 のテストベクターを使って HMAC-SHA1 署名が
   * 正しく計算されていることを検証する。
   *
   * 期待値 tR3+Ty81lMeYAr/Fid0kMTYa/WM= は仕様書に記載の値。
   */
  it("RFC 5849 Appendix A.2 テストベクターと一致する署名を生成する", async () => {
    const header = await buildZaimApiAuthHeader(
      {
        consumerKey: RFC.consumerKey,
        consumerSecret: RFC.consumerSecret,
        token: RFC.token,
        tokenSecret: RFC.tokenSecret,
      },
      RFC.method,
      RFC.url,
      RFC.queryParams,
    );
    expect(parseOAuthHeader(header).oauth_signature).toBe(RFC.expectedSignature);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("fetchZaimRequestToken", () => {
  const successBody =
    "oauth_token=req_token&oauth_token_secret=req_secret&oauth_callback_confirmed=true";

  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn().mockResolvedValue(new Response(successBody));
    vi.stubGlobal("fetch", mockFetch);
    vi.useFakeTimers();
    mockNonce("testnonce");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("ZaimのRequest Token エンドポイントにPOSTする", async () => {
    await fetchZaimRequestToken(
      { consumerKey: "key", consumerSecret: "secret" },
      "https://example.com/callback",
    );

    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.zaim.net/v2/auth/request");
    expect(init.method).toBe("POST");
  });

  it("AuthorizationヘッダーにOAuth 1.0aパラメータを含む", async () => {
    await fetchZaimRequestToken(
      { consumerKey: "mykey", consumerSecret: "mysecret" },
      "https://example.com/callback",
    );

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    const authHeader = (init.headers as Record<string, string>).Authorization;
    const params = parseOAuthHeader(authHeader);

    expect(params.oauth_consumer_key).toBe("mykey");
    expect(params.oauth_signature_method).toBe("HMAC-SHA1");
    expect(params.oauth_version).toBe("1.0");
  });

  it("AuthorizationヘッダーにURLエンコードされたoauth_callbackを含む", async () => {
    await fetchZaimRequestToken(
      { consumerKey: "key", consumerSecret: "secret" },
      "https://example.com/callback?foo=bar",
    );

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    const authHeader = (init.headers as Record<string, string>).Authorization;
    // parseOAuthHeader はデコード済みの値を返す
    expect(parseOAuthHeader(authHeader).oauth_callback).toBe(
      "https://example.com/callback?foo=bar",
    );
  });

  it("oauthTokenとoauthTokenSecretを返す", async () => {
    const result = await fetchZaimRequestToken(
      { consumerKey: "key", consumerSecret: "secret" },
      "https://example.com/callback",
    );
    expect(result).toEqual({ oauthToken: "req_token", oauthTokenSecret: "req_secret" });
  });

  it("HTTPエラーレスポンス時にエラーをスローする", async () => {
    mockFetch.mockResolvedValueOnce(new Response("Unauthorized", { status: 401 }));
    await expect(
      fetchZaimRequestToken(
        { consumerKey: "key", consumerSecret: "secret" },
        "https://example.com/callback",
      ),
    ).rejects.toThrow("Request token failed [401]");
  });

  it("レスポンスにoauth_tokenが欠ける場合にエラーをスローする", async () => {
    mockFetch.mockResolvedValueOnce(new Response("oauth_token_secret=only_secret"));
    await expect(
      fetchZaimRequestToken(
        { consumerKey: "key", consumerSecret: "secret" },
        "https://example.com/callback",
      ),
    ).rejects.toThrow("missing oauth_token or oauth_token_secret");
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("fetchZaimAccessToken", () => {
  const successBody = "oauth_token=access_token&oauth_token_secret=access_secret&user_id=12345";

  const config = {
    consumerKey: "key",
    consumerSecret: "secret",
    token: "req_token",
    tokenSecret: "req_secret",
  };

  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn().mockResolvedValue(new Response(successBody));
    vi.stubGlobal("fetch", mockFetch);
    vi.useFakeTimers();
    mockNonce("testnonce");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("ZaimのAccess Token エンドポイントにPOSTする", async () => {
    await fetchZaimAccessToken(config, "verifier123");

    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.zaim.net/v2/auth/access");
    expect(init.method).toBe("POST");
  });

  it("AuthorizationヘッダーにRequest TokenとVerifierを含む", async () => {
    await fetchZaimAccessToken(config, "myverifier");

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    const params = parseOAuthHeader((init.headers as Record<string, string>).Authorization);

    expect(params.oauth_token).toBe("req_token");
    expect(params.oauth_verifier).toBe("myverifier");
  });

  it("oauthToken・oauthTokenSecret・userIdを返す", async () => {
    const result = await fetchZaimAccessToken(config, "verifier");
    expect(result).toEqual({
      oauthToken: "access_token",
      oauthTokenSecret: "access_secret",
      userId: "12345",
    });
  });

  it("HTTPエラーレスポンス時にエラーをスローする", async () => {
    mockFetch.mockResolvedValueOnce(new Response("Bad Request", { status: 400 }));
    await expect(fetchZaimAccessToken(config, "verifier")).rejects.toThrow(
      "Access token failed [400]",
    );
  });

  it("レスポンスにuser_idが欠ける場合にエラーをスローする", async () => {
    mockFetch.mockResolvedValueOnce(new Response("oauth_token=tok&oauth_token_secret=sec"));
    await expect(fetchZaimAccessToken(config, "verifier")).rejects.toThrow(
      "missing required fields",
    );
  });
});
