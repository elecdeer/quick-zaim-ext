import { afterEach, describe, expect, test, vi } from "vite-plus/test";
import { accessAwareFetch, createServerClient } from "./serverClient";

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
  test("未ログインで Access にリダイレクトされた API 呼び出しは 401 になる", async () => {
    vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockResolvedValue(createOpaqueRedirectResponse()));

    const res = await createServerClient("https://server.example.com").me.$get();

    expect(res.status).toBe(401);
  });
});
