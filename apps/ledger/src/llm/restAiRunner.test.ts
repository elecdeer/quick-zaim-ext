import { describe, expect, test, vi } from "vite-plus/test";
import { createRestAiRunner } from "./restAiRunner.ts";

/**
 * 決まった JSON を返す fetch を作る。
 */
const fetchReturning = (status: number, body: unknown) =>
  vi.fn(async (_input: string, _init: RequestInit) => Response.json(body, { status }));

describe("createRestAiRunner", () => {
  test("アカウントの URL に、トークンとモデル・入力を付けて POST し、result を返す", async () => {
    const fetchFn = fetchReturning(200, { success: true, result: { response: "ok" } });
    const ai = createRestAiRunner({ accountId: "acc", apiToken: "token", fetchFn });

    const result = await ai.run("openai/gpt-5.4-mini", { messages: [] });

    expect(result).toEqual({ response: "ok" });
    const [url, init] = fetchFn.mock.calls[0] ?? [];
    expect(url).toBe("https://api.cloudflare.com/client/v4/accounts/acc/ai/run");
    expect(init?.method).toBe("POST");
    expect(new Headers(init?.headers).get("authorization")).toBe("Bearer token");
    expect(new Headers(init?.headers).get("cf-aig-gateway-id")).toBe("default");
    expect(init?.body).toBe(
      JSON.stringify({ model: "openai/gpt-5.4-mini", input: { messages: [] } }),
    );
  });

  test("失敗のレスポンスならエラーのメッセージを付けて投げる", async () => {
    const fetchFn = fetchReturning(400, { success: false, errors: [{ message: "bad model" }] });
    const ai = createRestAiRunner({ accountId: "acc", apiToken: "token", fetchFn });

    await expect(ai.run("x", {})).rejects.toThrow(
      "Workers AI の呼び出しに失敗しました（400）: bad model",
    );
  });
});
