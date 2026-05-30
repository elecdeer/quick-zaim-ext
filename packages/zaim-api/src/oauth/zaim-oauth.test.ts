/**
 * Zaim OAuth エンドポイント定義 (zaim-oauth.ts) のテスト
 */

import { describe, expect, test } from "vitest";
import { buildZaimApiAuthHeader, buildZaimAuthorizeUrl } from "./zaim-oauth.ts";
import { oauthTest, parseOAuthHeader, RFC } from "./test-fixtures.ts";

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
