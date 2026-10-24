/**
 * Access ユーザー取得（getAccessUser / getAccessUserFromJwt）のテスト
 *
 * ExecutionContext の ctx.access（Cloudflare Access がランタイムに付与する）、または
 * Cf-Access-Jwt-Assertion の JWT からユーザーを取り出す。
 */

import { afterEach, describe, expect, test, vi } from "vite-plus/test";
import { getAccessUser, getAccessUserFromJwt } from "./access.ts";
import { ACCESS_TEST_CONFIG, createAccessJwtSigner } from "./test-fixtures.ts";

describe("getAccessUser", () => {
  test("ctx.access の identity からメールアドレスを ID としたユーザーを返す", async () => {
    const ctx = {
      access: { aud: "aud", getIdentity: async () => ({ email: "user@example.com" }) },
    };

    await expect(getAccessUser(ctx)).resolves.toEqual({
      id: "user@example.com",
      email: "user@example.com",
    });
  });

  test("identity にメール以外のクレームが含まれていても取り出せる", async () => {
    const ctx = {
      access: {
        getIdentity: async () => ({
          email: "user@example.com",
          name: "User",
          idp: { type: "otp" },
        }),
      },
    };

    await expect(getAccessUser(ctx)).resolves.toEqual({
      id: "user@example.com",
      email: "user@example.com",
    });
  });

  test("getIdentity を ctx.access 自身を this として呼び出す", async () => {
    // ランタイムの getIdentity は this がネイティブオブジェクトでないと Illegal invocation になる
    class NativeAccess {
      readonly #email = "user@example.com";
      async getIdentity() {
        return { email: this.#email };
      }
    }

    await expect(getAccessUser({ access: new NativeAccess() })).resolves.toEqual({
      id: "user@example.com",
      email: "user@example.com",
    });
  });

  test("ctx.access がないとき（Access を通っていないリクエスト）は null を返す", async () => {
    await expect(getAccessUser({ waitUntil: vi.fn<() => void>() })).resolves.toBeNull();
  });

  test("ExecutionContext 自体がないときは null を返す", async () => {
    await expect(getAccessUser(undefined)).resolves.toBeNull();
  });

  test("identity にメールアドレスがないときは null を返す", async () => {
    const ctx = { access: { getIdentity: async () => ({ name: "Service token" }) } };

    await expect(getAccessUser(ctx)).resolves.toBeNull();
  });

  test("getIdentity が undefined を返すときは null を返す", async () => {
    const ctx = { access: { getIdentity: async () => undefined } };

    await expect(getAccessUser(ctx)).resolves.toBeNull();
  });
});

describe("getAccessUserFromJwt", () => {
  /** Access の certs エンドポイントが jwks を返すよう fetch を差し替える */
  const stubCertsEndpoint = (jwks: unknown) => {
    const mockFetch = vi.fn<typeof fetch>(async () => Response.json(jwks));
    vi.stubGlobal("fetch", mockFetch);
    return mockFetch;
  };

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("チームの公開鍵で検証できた JWT のメールアドレスを ID としたユーザーを返す", async () => {
    const signer = await createAccessJwtSigner();
    stubCertsEndpoint(signer.jwks);

    await expect(getAccessUserFromJwt(await signer.sign(), ACCESS_TEST_CONFIG)).resolves.toEqual({
      user: { id: "user@example.com", email: "user@example.com" },
    });
  });

  test("公開鍵はチームドメインの certs エンドポイントから取得する", async () => {
    const signer = await createAccessJwtSigner();
    const mockFetch = stubCertsEndpoint(signer.jwks);

    await getAccessUserFromJwt(await signer.sign(), {
      ...ACCESS_TEST_CONFIG,
      teamDomain: `${ACCESS_TEST_CONFIG.teamDomain}/`,
    });

    expect(mockFetch).toHaveBeenCalledWith(
      "https://test-team.cloudflareaccess.com/cdn-cgi/access/certs",
      undefined,
    );
  });

  test("aud が Access アプリケーションと一致しないときは拒否する", async () => {
    const signer = await createAccessJwtSigner();
    stubCertsEndpoint(signer.jwks);

    const result = await getAccessUserFromJwt(
      await signer.sign({ aud: ["other-app"] }),
      ACCESS_TEST_CONFIG,
    );

    expect(result.user).toBeNull();
    expect(result).toHaveProperty("reason", expect.stringContaining("verification failed"));
  });

  test("iss がチームドメインと一致しないときは拒否する", async () => {
    const signer = await createAccessJwtSigner();
    stubCertsEndpoint(signer.jwks);

    const result = await getAccessUserFromJwt(
      await signer.sign({ iss: "https://evil.cloudflareaccess.com" }),
      ACCESS_TEST_CONFIG,
    );

    expect(result.user).toBeNull();
  });

  test("期限切れの JWT は拒否する", async () => {
    const signer = await createAccessJwtSigner();
    stubCertsEndpoint(signer.jwks);
    const past = Math.floor(Date.now() / 1000) - 7200;

    const result = await getAccessUserFromJwt(
      await signer.sign({ iat: past, nbf: past, exp: past + 60 }),
      ACCESS_TEST_CONFIG,
    );

    expect(result.user).toBeNull();
  });

  test("チームの公開鍵以外で署名された JWT は拒否する", async () => {
    const trusted = await createAccessJwtSigner();
    const attacker = await createAccessJwtSigner();
    stubCertsEndpoint(trusted.jwks);

    const result = await getAccessUserFromJwt(await attacker.sign(), ACCESS_TEST_CONFIG);

    expect(result.user).toBeNull();
  });

  test("email クレームがない JWT（サービストークンなど）は拒否する", async () => {
    const signer = await createAccessJwtSigner();
    stubCertsEndpoint(signer.jwks);

    const result = await getAccessUserFromJwt(
      await signer.sign({ email: undefined, common_name: "service-token" }),
      ACCESS_TEST_CONFIG,
    );

    expect(result).toEqual({ user: null, reason: "Access JWT has no email claim" });
  });

  test("ヘッダーがないときは理由付きで null を返す", async () => {
    await expect(getAccessUserFromJwt(undefined, ACCESS_TEST_CONFIG)).resolves.toEqual({
      user: null,
      reason: "Cf-Access-Jwt-Assertion header is missing",
    });
  });

  test("チームドメインと AUD が未設定のときは検証せずに理由付きで null を返す", async () => {
    const mockFetch = stubCertsEndpoint({ keys: [] });

    await expect(getAccessUserFromJwt("token", undefined)).resolves.toEqual({
      user: null,
      reason: "ACCESS_TEAM_DOMAIN or ACCESS_AUD is not configured",
    });
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
