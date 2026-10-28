import type { AiRunner } from "./structuredChat.ts";

type FetchFn = (input: string, init: RequestInit) => Promise<Response>;

type RestResponse = {
  success?: boolean;
  result?: unknown;
  errors?: { message?: string }[];
};

/**
 * Cloudflare の AI の REST API（`/accounts/{accountId}/ai/run`）を呼ぶ AiRunner を作る。
 *
 * Worker の外（評価スクリプト）から台帳と同じ抽出を流すために使う。binding の `run` と同じく、
 * レスポンスの `result` をそのまま返す。
 * モデルを URL に入れる `/ai/run/{model}` は Workers AI（`@cf/`）のモデルにしか使えないので、
 * 他社のモデル（`openai/...` など）も呼べる、モデルを本文に入れる形を使う。
 * Workers AI のモデルにはゲートウェイの指定が要るので、既定のゲートウェイ（`default`）を付ける。
 */
export const createRestAiRunner = (params: {
  accountId: string;
  apiToken: string;
  fetchFn?: FetchFn;
}): AiRunner => {
  const fetchFn: FetchFn = params.fetchFn ?? ((input, init) => fetch(input, init));
  return {
    run: async (model, inputs, options) => {
      const response = await fetchFn(
        `https://api.cloudflare.com/client/v4/accounts/${params.accountId}/ai/run`,
        {
          method: "POST",
          headers: {
            authorization: `Bearer ${params.apiToken}`,
            "content-type": "application/json",
            "cf-aig-gateway-id": "default",
          },
          body: JSON.stringify({ model, input: inputs }),
          signal: options?.signal,
        },
      );
      const body: RestResponse = await response.json();
      if (!response.ok || body.success === false) {
        const messages = (body.errors ?? []).map((error) => error.message).join(", ");
        throw new Error(`Workers AI の呼び出しに失敗しました（${response.status}）: ${messages}`);
      }
      return body.result;
    },
  };
};
