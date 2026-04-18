/**
 * Zaim 固有 OAuth 1.0a ヘルパー (zaim-oauth.ts) のテスト
 */

import { describe, expect, test, vi } from "vite-plus/test";
import {
  buildZaimApiAuthHeader,
  buildZaimAuthorizeUrl,
  fetchZaimAccessToken,
  fetchZaimRequestToken,
} from "./zaim-oauth.ts";
import { oauthTest, parseOAuthHeader, RFC, type OAuthTestFixtures } from "./test-fixtures.ts";

// ── fetch モック付き拡張 test ────────────────────────────────────────────────

interface MockFetchFixtures extends OAuthTestFixtures {
  mockFetch: ReturnType<typeof vi.fn>;
}

const zaimTest = oauthTest.extend<Pick<MockFetchFixtures, "mockFetch">>({
  // eslint-disable-next-line no-empty-pattern
  mockFetch: async ({}, use: (value: ReturnType<typeof vi.fn>) => Promise<void>) => {
    const mock = vi.fn();
    vi.stubGlobal("fetch", mock);
    await use(mock);
    vi.unstubAllGlobals();
  },
});

// ── buildZaimAuthorizeUrl ────────────────────────────────────────────────────

describe("buildZaimAuthorizeUrl", () => {
  test("認可URLにoauth_tokenクエリパラメータを付与する", () => {
    expect(buildZaimAuthorizeUrl("mytoken123")).toBe(
      "https://auth.zaim.net/users/auth?oauth_token=mytoken123",
    );
  });

  test("oauth_tokenに含まれる特殊文字をパーセントエンコードする", () => {
    expect(buildZaimAuthorizeUrl("token+with/special=chars")).toBe(
      "https://auth.zaim.net/users/auth?oauth_token=token%2Bwith%2Fspecial%3Dchars",
    );
  });
});

// ── buildZaimApiAuthHeader ───────────────────────────────────────────────────

describe("buildZaimApiAuthHeader", () => {
  oauthTest(
    "RFC 5849 Appendix A.2 テストベクターと一致する署名を生成する",
    async ({ fixedTime: _t, mockedNonce: _n }) => {
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
    },
  );

  oauthTest(
    "クエリパラメータが異なれば署名も異なる",
    async ({ fixedTime: _t, mockedNonce: _n }) => {
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
    },
  );
});

// ── fetchZaimRequestToken ────────────────────────────────────────────────────

describe("fetchZaimRequestToken", () => {
  const SUCCESS_BODY =
    "oauth_token=req_token&oauth_token_secret=req_secret&oauth_callback_confirmed=true";

  zaimTest(
    "ZaimのRequest Token エンドポイントにPOSTする",
    async ({ fixedTime: _t, mockedNonce: _n, mockFetch }) => {
      mockFetch.mockResolvedValue(new Response(SUCCESS_BODY));

      await fetchZaimRequestToken(
        { consumerKey: "key", consumerSecret: "secret" },
        "https://example.com/callback",
      );

      const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(url).toBe("https://api.zaim.net/v2/auth/request");
      expect(init.method).toBe("POST");
    },
  );

  zaimTest(
    "AuthorizationヘッダーにOAuth 1.0aパラメータを含む",
    async ({ fixedTime: _t, mockedNonce: _n, mockFetch }) => {
      mockFetch.mockResolvedValue(new Response(SUCCESS_BODY));

      await fetchZaimRequestToken(
        { consumerKey: "mykey", consumerSecret: "mysecret" },
        "https://example.com/callback",
      );

      const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
      const params = parseOAuthHeader((init.headers as Record<string, string>).Authorization);
      expect(params.oauth_consumer_key).toBe("mykey");
      expect(params.oauth_signature_method).toBe("HMAC-SHA1");
      expect(params.oauth_version).toBe("1.0");
    },
  );

  zaimTest(
    "AuthorizationヘッダーにURLエンコードされたoauth_callbackを含む",
    async ({ fixedTime: _t, mockedNonce: _n, mockFetch }) => {
      mockFetch.mockResolvedValue(new Response(SUCCESS_BODY));

      await fetchZaimRequestToken(
        { consumerKey: "key", consumerSecret: "secret" },
        "https://example.com/callback?foo=bar",
      );

      const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
      const params = parseOAuthHeader((init.headers as Record<string, string>).Authorization);
      expect(params.oauth_callback).toBe("https://example.com/callback?foo=bar");
    },
  );

  zaimTest(
    "oauthTokenとoauthTokenSecretを返す",
    async ({ fixedTime: _t, mockedNonce: _n, mockFetch }) => {
      mockFetch.mockResolvedValue(new Response(SUCCESS_BODY));

      const result = await fetchZaimRequestToken(
        { consumerKey: "key", consumerSecret: "secret" },
        "https://example.com/callback",
      );
      expect(result).toEqual({ oauthToken: "req_token", oauthTokenSecret: "req_secret" });
    },
  );

  zaimTest(
    "HTTPエラーレスポンス時にエラーをスローする",
    async ({ fixedTime: _t, mockedNonce: _n, mockFetch }) => {
      mockFetch.mockResolvedValue(new Response("Unauthorized", { status: 401 }));

      await expect(
        fetchZaimRequestToken(
          { consumerKey: "key", consumerSecret: "secret" },
          "https://example.com/callback",
        ),
      ).rejects.toThrow("Request token failed [401]");
    },
  );

  zaimTest(
    "レスポンスにoauth_tokenが欠ける場合にエラーをスローする",
    async ({ fixedTime: _t, mockedNonce: _n, mockFetch }) => {
      mockFetch.mockResolvedValue(new Response("oauth_token_secret=only_secret"));

      await expect(
        fetchZaimRequestToken(
          { consumerKey: "key", consumerSecret: "secret" },
          "https://example.com/callback",
        ),
      ).rejects.toThrow("missing oauth_token or oauth_token_secret");
    },
  );
});

// ── fetchZaimAccessToken ─────────────────────────────────────────────────────

describe("fetchZaimAccessToken", () => {
  const SUCCESS_BODY = "oauth_token=access_token&oauth_token_secret=access_secret&user_id=12345";

  const REQ_CONFIG = {
    consumerKey: "key",
    consumerSecret: "secret",
    token: "req_token",
    tokenSecret: "req_secret",
  };

  zaimTest(
    "ZaimのAccess Token エンドポイントにPOSTする",
    async ({ fixedTime: _t, mockedNonce: _n, mockFetch }) => {
      mockFetch.mockResolvedValue(new Response(SUCCESS_BODY));

      await fetchZaimAccessToken(REQ_CONFIG, "verifier123");

      const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(url).toBe("https://api.zaim.net/v2/auth/access");
      expect(init.method).toBe("POST");
    },
  );

  zaimTest(
    "AuthorizationヘッダーにRequest TokenとVerifierを含む",
    async ({ fixedTime: _t, mockedNonce: _n, mockFetch }) => {
      mockFetch.mockResolvedValue(new Response(SUCCESS_BODY));

      await fetchZaimAccessToken(REQ_CONFIG, "myverifier");

      const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
      const params = parseOAuthHeader((init.headers as Record<string, string>).Authorization);
      expect(params.oauth_token).toBe("req_token");
      expect(params.oauth_verifier).toBe("myverifier");
    },
  );

  zaimTest(
    "oauthToken・oauthTokenSecret・userIdを返す",
    async ({ fixedTime: _t, mockedNonce: _n, mockFetch }) => {
      mockFetch.mockResolvedValue(new Response(SUCCESS_BODY));

      const result = await fetchZaimAccessToken(REQ_CONFIG, "verifier");
      expect(result).toEqual({
        oauthToken: "access_token",
        oauthTokenSecret: "access_secret",
        userId: "12345",
      });
    },
  );

  zaimTest(
    "HTTPエラーレスポンス時にエラーをスローする",
    async ({ fixedTime: _t, mockedNonce: _n, mockFetch }) => {
      mockFetch.mockResolvedValue(new Response("Bad Request", { status: 400 }));

      await expect(fetchZaimAccessToken(REQ_CONFIG, "verifier")).rejects.toThrow(
        "Access token failed [400]",
      );
    },
  );

  zaimTest(
    "レスポンスにuser_idが欠ける場合にエラーをスローする",
    async ({ fixedTime: _t, mockedNonce: _n, mockFetch }) => {
      mockFetch.mockResolvedValue(new Response("oauth_token=tok&oauth_token_secret=sec"));

      await expect(fetchZaimAccessToken(REQ_CONFIG, "verifier")).rejects.toThrow(
        "missing required fields",
      );
    },
  );
});
