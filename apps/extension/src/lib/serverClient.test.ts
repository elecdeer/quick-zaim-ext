import { afterEach, describe, expect, test, vi } from "vite-plus/test";
import { LedgerFetchError } from "ledger/client";
import { accessAwareFetch, createServerClient, withErrorMessage } from "./serverClient";

/**
 * redirect: "manual" で Access のログイン画面へのリダイレクトを受けたときの Response を作る。
 * Node の Response では type を変えられないため、プロパティを上書きして再現する。
 */
const createOpaqueRedirectResponse = (): Response => {
  const res = new Response(null, { status: 200 });
  Object.defineProperty(res, "type", { value: "opaqueredirect" });
  return res;
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("accessAwareFetch", () => {
  test("Access のログイン画面へのリダイレクトを 401 に変換する", async () => {
    vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockResolvedValue(createOpaqueRedirectResponse()));

    const res = await accessAwareFetch("https://server.example.com/me");

    expect(res.status).toBe(401);
    expect(res.ok).toBe(false);
  });

  test("リダイレクト以外のレスポンスはそのまま返す", async () => {
    const original = Response.json({ email: "user@example.com" });
    vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockResolvedValue(original));

    const res = await accessAwareFetch("https://server.example.com/me");

    expect(res).toBe(original);
  });

  test("Cookie を送り、リダイレクトを追わない設定でリクエストする", async () => {
    const mockFetch = vi.fn<typeof fetch>().mockResolvedValue(new Response(null));
    vi.stubGlobal("fetch", mockFetch);

    await accessAwareFetch("https://server.example.com/me", { method: "DELETE" });

    expect(mockFetch).toHaveBeenCalledWith("https://server.example.com/me", {
      method: "DELETE",
      credentials: "include",
      redirect: "manual",
    });
  });
});

describe("createServerClient", () => {
  test("未ログインで Access にリダイレクトされた API 呼び出しは 401 のエラーになる", async () => {
    vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockResolvedValue(createOpaqueRedirectResponse()));

    const request = createServerClient("https://server.example.com")("/me", "GET");

    await expect(request).rejects.toMatchObject({ name: "LedgerFetchError", status: 401 });
  });

  test("Cookie を送る設定で台帳 API を呼び、JSON を返す", async () => {
    const mockFetch = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json({ email: "user@example.com", id: "user@example.com" }));
    vi.stubGlobal("fetch", mockFetch);

    const me = await createServerClient("https://server.example.com")("/me", "GET");

    expect(me).toEqual({ email: "user@example.com", id: "user@example.com" });
    expect(mockFetch).toHaveBeenCalledWith(
      new URL("https://server.example.com/me"),
      expect.objectContaining({ method: "GET", credentials: "include", redirect: "manual" }),
    );
  });
});

describe("withErrorMessage", () => {
  test("成功したらそのまま値を返す", async () => {
    await expect(withErrorMessage("登録", Promise.resolve(1))).resolves.toBe(1);
  });

  test("台帳がエラーを返したら状態コード付きのメッセージにする", async () => {
    const request = Promise.reject(new LedgerFetchError(502, { error: "upstream" }));

    await expect(withErrorMessage("登録", request)).rejects.toThrow("登録に失敗しました（502）");
  });

  test("通信できなかったときは状態コードなしのメッセージにする", async () => {
    const request = Promise.reject(new TypeError("Failed to fetch"));

    await expect(withErrorMessage("登録", request)).rejects.toThrow("登録に失敗しました");
  });
});
