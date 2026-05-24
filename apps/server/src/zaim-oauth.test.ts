/**
 * Zaim 固有 OAuth 1.0a ヘルパー (zaim-oauth.ts) のサーバー依存 fetch ロジックのテスト
 *
 * 純粋関数 (buildZaimAuthorizeUrl, buildZaimApiAuthHeader) は
 * @repo/zaim-api 側でテスト済みのため、ここでは SDK 呼び出しを伴う関数のみテストする。
 */

import { beforeEach, describe, expect, vi } from "vite-plus/test";
import { getLogger } from "@logtape/logtape";
import { fetchZaimAccessToken, fetchZaimRequestToken } from "./zaim-oauth.ts";
import { oauthTest, parseOAuthHeader } from "./test-fixtures.ts";

const testLogger = getLogger(["quick-zaim", "server"]);

beforeEach(() => {
  vi.clearAllMocks();
});

const { mockAuthRequestToken, mockAuthAccessToken } = vi.hoisted(() => ({
  mockAuthRequestToken: vi.fn(),
  mockAuthAccessToken: vi.fn(),
}));

vi.mock("@repo/zaim-api", () => ({
  authRequestToken: mockAuthRequestToken,
  authAccessToken: mockAuthAccessToken,
}));

vi.mock("@repo/zaim-api/client", () => ({
  createClient: vi.fn(() => ({
    interceptors: { request: { use: vi.fn() } },
  })),
}));

// ── fetchZaimRequestToken ────────────────────────────────────────────────────

describe("fetchZaimRequestToken", () => {
  const SUCCESS_BODY =
    "oauth_token=req_token&oauth_token_secret=req_secret&oauth_callback_confirmed=true";

  oauthTest(
    "ZaimのRequest Token エンドポイントにPOSTする",
    async ({ fixedTime: _t, mockedNonce: _n }) => {
      mockAuthRequestToken.mockResolvedValue({
        data: SUCCESS_BODY,
        response: new Response(SUCCESS_BODY),
      });

      await fetchZaimRequestToken(
        { consumerKey: "key", consumerSecret: "secret" },
        "https://example.com/callback",
        testLogger,
      );

      expect(mockAuthRequestToken).toHaveBeenCalled();
    },
  );

  oauthTest(
    "AuthorizationヘッダーにOAuth 1.0aパラメータを含む",
    async ({ fixedTime: _t, mockedNonce: _n }) => {
      mockAuthRequestToken.mockResolvedValue({
        data: SUCCESS_BODY,
        response: new Response(SUCCESS_BODY),
      });

      await fetchZaimRequestToken(
        { consumerKey: "mykey", consumerSecret: "mysecret" },
        "https://example.com/callback",
        testLogger,
      );

      const options = mockAuthRequestToken.mock.calls[0][0];
      const params = parseOAuthHeader(options.headers.Authorization as string);
      expect(params.oauth_consumer_key).toBe("mykey");
      expect(params.oauth_signature_method).toBe("HMAC-SHA1");
      expect(params.oauth_version).toBe("1.0");
    },
  );

  oauthTest(
    "AuthorizationヘッダーにURLエンコードされたoauth_callbackを含む",
    async ({ fixedTime: _t, mockedNonce: _n }) => {
      mockAuthRequestToken.mockResolvedValue({
        data: SUCCESS_BODY,
        response: new Response(SUCCESS_BODY),
      });

      await fetchZaimRequestToken(
        { consumerKey: "key", consumerSecret: "secret" },
        "https://example.com/callback?foo=bar",
        testLogger,
      );

      const options = mockAuthRequestToken.mock.calls[0][0];
      const params = parseOAuthHeader(options.headers.Authorization as string);
      expect(params.oauth_callback).toBe("https://example.com/callback?foo=bar");
    },
  );

  oauthTest("oauthTokenとoauthTokenSecretを返す", async ({ fixedTime: _t, mockedNonce: _n }) => {
    mockAuthRequestToken.mockResolvedValue({
      data: SUCCESS_BODY,
      response: new Response(SUCCESS_BODY),
    });

    const result = await fetchZaimRequestToken(
      { consumerKey: "key", consumerSecret: "secret" },
      "https://example.com/callback",
      testLogger,
    );
    expect(result).toEqual({ oauthToken: "req_token", oauthTokenSecret: "req_secret" });
  });

  oauthTest(
    "HTTPエラーレスポンス時にエラーをスローする",
    async ({ fixedTime: _t, mockedNonce: _n }) => {
      mockAuthRequestToken.mockResolvedValue({
        error: "Unauthorized",
        response: new Response("Unauthorized", { status: 401 }),
      });

      await expect(
        fetchZaimRequestToken(
          { consumerKey: "key", consumerSecret: "secret" },
          "https://example.com/callback",
          testLogger,
        ),
      ).rejects.toThrow("Request token failed [401]");
    },
  );

  oauthTest(
    "レスポンスにoauth_tokenが欠ける場合にエラーをスローする",
    async ({ fixedTime: _t, mockedNonce: _n }) => {
      mockAuthRequestToken.mockResolvedValue({
        data: "oauth_token_secret=only_secret",
        response: new Response("oauth_token_secret=only_secret"),
      });

      await expect(
        fetchZaimRequestToken(
          { consumerKey: "key", consumerSecret: "secret" },
          "https://example.com/callback",
          testLogger,
        ),
      ).rejects.toThrow();
    },
  );
});

// ── fetchZaimAccessToken ─────────────────────────────────────────────────────

describe("fetchZaimAccessToken", () => {
  const SUCCESS_BODY = "oauth_token=access_token&oauth_token_secret=access_secret";

  const REQ_CONFIG = {
    consumerKey: "key",
    consumerSecret: "secret",
    token: "req_token",
    tokenSecret: "req_secret",
  };

  oauthTest(
    "ZaimのAccess Token エンドポイントにPOSTする",
    async ({ fixedTime: _t, mockedNonce: _n }) => {
      mockAuthAccessToken.mockResolvedValue({
        data: SUCCESS_BODY,
        response: new Response(SUCCESS_BODY),
      });

      await fetchZaimAccessToken(REQ_CONFIG, "verifier123", testLogger);

      expect(mockAuthAccessToken).toHaveBeenCalled();
    },
  );

  oauthTest(
    "AuthorizationヘッダーにRequest TokenとVerifierを含む",
    async ({ fixedTime: _t, mockedNonce: _n }) => {
      mockAuthAccessToken.mockResolvedValue({
        data: SUCCESS_BODY,
        response: new Response(SUCCESS_BODY),
      });

      await fetchZaimAccessToken(REQ_CONFIG, "myverifier", testLogger);

      const options = mockAuthAccessToken.mock.calls[0][0];
      const params = parseOAuthHeader(options.headers.Authorization as string);
      expect(params.oauth_token).toBe("req_token");
      expect(params.oauth_verifier).toBe("myverifier");
    },
  );

  oauthTest(
    "oauthToken・oauthTokenSecret・userIdを返す",
    async ({ fixedTime: _t, mockedNonce: _n }) => {
      mockAuthAccessToken.mockResolvedValue({
        data: SUCCESS_BODY,
        response: new Response(SUCCESS_BODY),
      });

      const result = await fetchZaimAccessToken(REQ_CONFIG, "verifier", testLogger);
      expect(result).toEqual({
        oauthToken: "access_token",
        oauthTokenSecret: "access_secret",
      });
    },
  );

  oauthTest(
    "HTTPエラーレスポンス時にエラーをスローする",
    async ({ fixedTime: _t, mockedNonce: _n }) => {
      mockAuthAccessToken.mockResolvedValue({
        error: "Bad Request",
        response: new Response("Bad Request", { status: 400 }),
      });

      await expect(fetchZaimAccessToken(REQ_CONFIG, "verifier", testLogger)).rejects.toThrow(
        "Access token failed [400]",
      );
    },
  );

  oauthTest(
    "oauth_tokenが欠ける場合にエラーをスローする",
    async ({ fixedTime: _t, mockedNonce: _n }) => {
      mockAuthAccessToken.mockResolvedValue({
        data: "oauth_token_secret=sec",
        response: new Response("oauth_token_secret=sec"),
      });

      await expect(fetchZaimAccessToken(REQ_CONFIG, "verifier", testLogger)).rejects.toThrow();
    },
  );
});
