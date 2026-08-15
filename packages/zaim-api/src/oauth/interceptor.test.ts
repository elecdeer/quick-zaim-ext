import { assert, describe, expect } from "vite-plus/test";
import { createZaimAuthInterceptor } from "./interceptor";
import { oauthTest, parseOAuthHeader, RFC } from "./test-fixtures";

describe("createZaimAuthInterceptor", () => {
  oauthTest(
    "リクエストに OAuth 1.0a 認証ヘッダーを追加する",
    async ({ fixedTime: _t, mockedNonce: _n }) => {
      const interceptor = createZaimAuthInterceptor({
        consumerKey: RFC.consumerKey,
        consumerSecret: RFC.consumerSecret,
        token: RFC.token,
        tokenSecret: RFC.tokenSecret,
      });

      const url = new URL(RFC.url);
      for (const [key, value] of Object.entries(RFC.queryParams)) {
        url.searchParams.set(key, value);
      }
      const req = new Request(url, {
        method: RFC.method,
      });

      const interceptedReq = await interceptor(req);
      const authHeader = interceptedReq.headers.get("Authorization");
      assert.exists(authHeader);
      expect(parseOAuthHeader(authHeader).oauth_signature).toBe(RFC.expectedSignature);
    },
  );
});
