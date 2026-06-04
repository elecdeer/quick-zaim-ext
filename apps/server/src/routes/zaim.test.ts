/**
 * zaim ルートのテスト
 *
 * GET  /zaim/auth/start    - Zaim OAuth 開始
 * GET  /zaim/auth/callback - Zaim からのコールバック
 * GET  /zaim/auth/status   - Zaim 連携状態確認
 * DELETE /zaim/auth/token  - Zaim 連携解除
 */

import { beforeEach, describe, expect, test, vi } from "vitest";
import { createKVNamespaceMock, createTestClient, createTestEnv } from "../test-fixtures.ts";
import { zaimRoutes } from "./zaim.ts";
import type { Env } from "../env.ts";
import type { KVNamespace } from "@cloudflare/workers-types";
import type { OidcAuth } from "@hono/oidc-auth";

vi.mock("../zaim-oauth.ts", () => ({
  fetchZaimRequestToken: vi.fn(),
  fetchZaimAccessToken: vi.fn(),
  fetchZaimUserId: vi.fn(),
  buildZaimAuthorizeUrl: vi.fn(
    (token: string) => `https://auth.zaim.net/users/auth?oauth_token=${token}`,
  ),
}));

import { fetchZaimRequestToken, fetchZaimAccessToken, fetchZaimUserId } from "../zaim-oauth.ts";

const mockFetchRequestToken = vi.mocked(fetchZaimRequestToken);
const mockFetchAccessToken = vi.mocked(fetchZaimAccessToken);
const mockFetchUserId = vi.mocked(fetchZaimUserId);

const MOCK_USER = {
  sub: "auth0|user123",
  email: "user@example.com",
  rtk: "",
  rtkexp: 9999999999,
  ssnexp: 9999999999,
} as OidcAuth;

const makeEnv = (kvOverride?: KVNamespace): Env =>
  kvOverride ? createTestEnv({ ZAIM_KV: kvOverride }) : createTestEnv();

// ── GET /zaim/auth/start ──────────────────────────────────────────────────────

describe("GET /zaim/auth/start", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchRequestToken.mockResolvedValue({
      oauthToken: "req_token_abc",
      oauthTokenSecret: "req_secret_xyz",
    });
  });

  test("OIDC未認証のとき401を返す", async () => {
    const res = await createTestClient(zaimRoutes, makeEnv(), {
      oidcAuth: null,
    }).zaim.auth.start.$get({ query: {} });
    expect(res.status).toBe(401);
  });

  test("通常フロー: Zaim認可URLへリダイレクトする", async () => {
    const res = await createTestClient(zaimRoutes, makeEnv(), {
      oidcAuth: MOCK_USER,
    }).zaim.auth.start.$get({ query: {} });
    expect(res.status).toBe(302);
    const location = res.headers.get("Location") ?? "";
    expect(location).toContain("auth.zaim.net");
    expect(location).toContain("req_token_abc");
  });

  test("通常フロー: Request TokenをKVに保存する", async () => {
    const { kv, mockPut } = createKVNamespaceMock();
    await createTestClient(zaimRoutes, makeEnv(kv), { oidcAuth: MOCK_USER }).zaim.auth.start.$get({
      query: {},
    });
    expect(mockPut).toHaveBeenCalledWith(
      "zaim:request:req_token_abc",
      expect.stringContaining("req_secret_xyz"),
      { expirationTtl: 600 },
    );
  });

  test("拡張機能フロー: ext_redirect_uriを指定するとauthorizeUrlをJSONで返す", async () => {
    const extUri = "https://abc.chromiumapp.org/callback";
    const res = await createTestClient(zaimRoutes, makeEnv(), {
      oidcAuth: MOCK_USER,
    }).zaim.auth.start.$get({
      query: { ext_redirect_uri: extUri },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { authorizeUrl: string };
    expect(body.authorizeUrl).toContain("auth.zaim.net");
  });

  test("拡張機能フロー: ext_redirect_uriにはchromiumapp.orgのみ許可", async () => {
    const res = await createTestClient(zaimRoutes, makeEnv(), {
      oidcAuth: MOCK_USER,
    }).zaim.auth.start.$get({
      query: { ext_redirect_uri: "https://evil.example.com/cb" },
    });
    expect(res.status).toBe(400);
  });

  test("KVのRequestTokenStateにuserSubとextRedirectUriが入る", async () => {
    const { kv, mockPut } = createKVNamespaceMock();
    const extUri = "https://abc.chromiumapp.org/callback";
    await createTestClient(zaimRoutes, makeEnv(kv), { oidcAuth: MOCK_USER }).zaim.auth.start.$get({
      query: { ext_redirect_uri: extUri },
    });
    const [, storedJson] = mockPut.mock.calls[0] as unknown as [string, string, unknown];
    const state = JSON.parse(storedJson) as { userSub: string; extRedirectUri: string };
    expect(state.userSub).toBe(MOCK_USER.sub);
    expect(state.extRedirectUri).toBe(extUri);
  });
});

// ── GET /zaim/auth/callback ───────────────────────────────────────────────────

describe("GET /zaim/auth/callback", () => {
  const storedState = JSON.stringify({
    tokenSecret: "req_secret_xyz",
    userSub: "auth0|user123",
    extRedirectUri: undefined,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchAccessToken.mockResolvedValue({
      oauthToken: "access_token_abc",
      oauthTokenSecret: "access_secret_xyz",
    });
    mockFetchUserId.mockResolvedValue("zaim_user_999");
  });

  test("oauth_tokenまたはoauth_verifierが欠けると400を返す", async () => {
    const res = await zaimRoutes.request(
      "http://localhost/zaim/auth/callback?oauth_token=tok",
      {},
      makeEnv(),
    );
    expect(res.status).toBe(400);
  });

  test("KVにRequest Tokenが存在しない場合400を返す", async () => {
    const res = await createTestClient(zaimRoutes, makeEnv()).zaim.auth.callback.$get({
      query: { oauth_token: "unknown", oauth_verifier: "ver" },
    });
    expect(res.status).toBe(400);
  });

  test("正常フロー: Access TokenをKVに保存してzaimUserIdを返す", async () => {
    const { kv, mockGet } = createKVNamespaceMock();
    mockGet.mockResolvedValueOnce(storedState);

    const res = await createTestClient(zaimRoutes, makeEnv(kv)).zaim.auth.callback.$get({
      query: { oauth_token: "req_token_abc", oauth_verifier: "verifier123" },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; zaimUserId: string };
    expect(body.ok).toBe(true);
    expect(body.zaimUserId).toBe("zaim_user_999");
  });

  test("Access TokenをKVの zaim:token:{sub} に保存する", async () => {
    const { kv, mockGet, mockPut } = createKVNamespaceMock();
    mockGet.mockResolvedValueOnce(storedState);

    await createTestClient(zaimRoutes, makeEnv(kv)).zaim.auth.callback.$get({
      query: { oauth_token: "req_token_abc", oauth_verifier: "verifier123" },
    });

    const [putKey, putVal] = mockPut.mock.calls[0] as [string, string];
    expect(putKey).toBe("zaim:token:auth0|user123");
    const saved = JSON.parse(putVal) as { oauthToken: string; zaimUserId: string };
    expect(saved.oauthToken).toBe("access_token_abc");
    expect(saved.zaimUserId).toBe("zaim_user_999");
  });

  test("Request TokenをKVから削除する", async () => {
    const { kv, mockGet, mockDelete } = createKVNamespaceMock();
    mockGet.mockResolvedValueOnce(storedState);

    await createTestClient(zaimRoutes, makeEnv(kv)).zaim.auth.callback.$get({
      query: { oauth_token: "req_token_abc", oauth_verifier: "verifier123" },
    });

    expect(mockDelete).toHaveBeenCalledWith("zaim:request:req_token_abc");
  });

  test("拡張機能フロー: extRedirectUriへリダイレクトする", async () => {
    const extUri = "https://abc.chromiumapp.org/callback";
    const stateWithExt = JSON.stringify({
      tokenSecret: "req_secret_xyz",
      userSub: "auth0|user123",
      extRedirectUri: extUri,
    });

    const { kv, mockGet } = createKVNamespaceMock();
    mockGet.mockResolvedValueOnce(stateWithExt);

    const res = await createTestClient(zaimRoutes, makeEnv(kv)).zaim.auth.callback.$get({
      query: { oauth_token: "req_token_abc", oauth_verifier: "verifier123" },
    });
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe(extUri);
  });
});

// ── GET /zaim/auth/status ─────────────────────────────────────────────────────

describe("GET /zaim/auth/status", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("OIDC未認証のとき401を返す", async () => {
    const res = await createTestClient(zaimRoutes, makeEnv(), {
      oidcAuth: null,
    }).zaim.auth.status.$get({});
    expect(res.status).toBe(401);
  });

  test("KVにトークンがない場合 connected: false を返す", async () => {
    const res = await createTestClient(zaimRoutes, makeEnv(), {
      oidcAuth: MOCK_USER,
    }).zaim.auth.status.$get({});
    expect(res.status).toBe(200);
    const body = (await res.json()) as { connected: boolean };
    expect(body.connected).toBe(false);
  });

  test("KVにトークンがある場合 connected: true とzaimUserIdを返す", async () => {
    const { kv, mockGet } = createKVNamespaceMock();
    const stored = JSON.stringify({
      oauthToken: "access_token",
      oauthTokenSecret: "access_secret",
      zaimUserId: "zaim_user_999",
    });
    mockGet.mockResolvedValueOnce(stored);

    const res = await createTestClient(zaimRoutes, makeEnv(kv), {
      oidcAuth: MOCK_USER,
    }).zaim.auth.status.$get({});
    expect(res.status).toBe(200);
    const body = (await res.json()) as { connected: boolean; zaimUserId: string };
    expect(body.connected).toBe(true);
    expect(body.zaimUserId).toBe("zaim_user_999");
  });

  test("ユーザーのsubに対応するKVキーを参照する", async () => {
    const { kv, mockGet } = createKVNamespaceMock();
    await createTestClient(zaimRoutes, makeEnv(kv), { oidcAuth: MOCK_USER }).zaim.auth.status.$get(
      {},
    );
    expect(mockGet).toHaveBeenCalledWith("zaim:token:auth0|user123");
  });
});

// ── DELETE /zaim/auth/token ───────────────────────────────────────────────────

describe("DELETE /zaim/auth/token", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("OIDC未認証のとき401を返す", async () => {
    const res = await createTestClient(zaimRoutes, makeEnv(), {
      oidcAuth: null,
    }).zaim.auth.token.$delete();
    expect(res.status).toBe(401);
  });

  test("KVからアクセストークンを削除して ok: true を返す", async () => {
    const { kv, mockDelete } = createKVNamespaceMock();
    const res = await createTestClient(zaimRoutes, makeEnv(kv), {
      oidcAuth: MOCK_USER,
    }).zaim.auth.token.$delete();
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean };
    expect(body.ok).toBe(true);
    expect(mockDelete).toHaveBeenCalledWith("zaim:token:auth0|user123");
  });
});
