/**
 * 汎用 OAuth 1.0a コア (oauth1.ts) のテスト
 *
 * 署名の正確性検証には RFC 5849 Appendix A.2 のテストベクターを使用する。
 *   Expected sig: tR3+Ty81lMeYAr/Fid0kMTYa/WM=
 */

import { describe, expect } from "vite-plus/test";
import { buildOAuth1AuthorizationHeader } from "./oauth1.ts";
import { oauthTest, parseOAuthHeader, RFC } from "./test-fixtures.ts";

describe("buildOAuth1AuthorizationHeader", () => {
  oauthTest(
    "'OAuth ' で始まるAuthorizationヘッダーを返す",
    async ({ fixedTime: _t, mockedNonce: _n }) => {
      const header = await buildOAuth1AuthorizationHeader(
        "GET",
        "https://api.example.com/resource",
        {
          consumerKey: "key",
          consumerSecret: "secret",
        },
      );
      expect(header).toMatch(/^OAuth /);
    },
  );

  oauthTest(
    "必須OAuthパラメータをすべてヘッダーに含む",
    async ({ fixedTime: _t, mockedNonce: _n }) => {
      const header = await buildOAuth1AuthorizationHeader(
        "GET",
        "https://api.example.com/resource",
        {
          consumerKey: "mykey",
          consumerSecret: "mysecret",
        },
      );
      expect(parseOAuthHeader(header)).toMatchObject({
        oauth_consumer_key: "mykey",
        oauth_nonce: RFC.nonce,
        oauth_signature_method: "HMAC-SHA1",
        oauth_timestamp: String(RFC.timestamp),
        oauth_version: "1.0",
      });
    },
  );

  oauthTest(
    "config.token が指定された場合は oauth_token をヘッダーに含む",
    async ({ fixedTime: _t, mockedNonce: _n }) => {
      const header = await buildOAuth1AuthorizationHeader(
        "GET",
        "https://api.example.com/resource",
        { consumerKey: "key", consumerSecret: "secret", token: "mytoken" },
      );
      expect(parseOAuthHeader(header).oauth_token).toBe("mytoken");
    },
  );

  oauthTest(
    "config.token が未指定の場合は oauth_token をヘッダーに含まない",
    async ({ fixedTime: _t, mockedNonce: _n }) => {
      const header = await buildOAuth1AuthorizationHeader(
        "GET",
        "https://api.example.com/resource",
        { consumerKey: "key", consumerSecret: "secret" },
      );
      expect(parseOAuthHeader(header).oauth_token).toBeUndefined();
    },
  );

  oauthTest(
    "extraOAuthParams を署名対象に含めてヘッダーに出力する",
    async ({ fixedTime: _t, mockedNonce: _n }) => {
      const header = await buildOAuth1AuthorizationHeader(
        "POST",
        "https://api.example.com/token",
        { consumerKey: "key", consumerSecret: "secret" },
        { oauth_callback: "https://example.com/cb" },
      );
      expect(parseOAuthHeader(header).oauth_callback).toBe("https://example.com/cb");
    },
  );

  oauthTest(
    "bodyOrQueryParams が異なれば署名も異なる",
    async ({ fixedTime: _t, mockedNonce: _n }) => {
      const withParams = await buildOAuth1AuthorizationHeader(
        "GET",
        "https://api.example.com/resource",
        { consumerKey: "key", consumerSecret: "secret" },
        {},
        { foo: "bar" },
      );
      const withoutParams = await buildOAuth1AuthorizationHeader(
        "GET",
        "https://api.example.com/resource",
        { consumerKey: "key", consumerSecret: "secret" },
      );
      expect(parseOAuthHeader(withParams).oauth_signature).not.toBe(
        parseOAuthHeader(withoutParams).oauth_signature,
      );
    },
  );

  /**
   * RFC 5849 Appendix A.2 のテストベクターで HMAC-SHA1 署名の正確性を検証する。
   * 期待値 tR3+Ty81lMeYAr/Fid0kMTYa/WM= は仕様書に記載の値。
   */
  oauthTest(
    "RFC 5849 Appendix A.2 テストベクターと一致する署名を生成する",
    async ({ fixedTime: _t, mockedNonce: _n }) => {
      const header = await buildOAuth1AuthorizationHeader(
        RFC.method,
        RFC.url,
        {
          consumerKey: RFC.consumerKey,
          consumerSecret: RFC.consumerSecret,
          token: RFC.token,
          tokenSecret: RFC.tokenSecret,
        },
        {},
        RFC.queryParams,
      );
      expect(parseOAuthHeader(header).oauth_signature).toBe(RFC.expectedSignature);
    },
  );
});
