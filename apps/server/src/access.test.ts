/**
 * getAccessUser のテスト
 *
 * ExecutionContext の ctx.access（Cloudflare Access がランタイムに付与する）からユーザーを取り出す。
 */

import { describe, expect, test, vi } from "vite-plus/test";
import { getAccessUser } from "./access.ts";

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
