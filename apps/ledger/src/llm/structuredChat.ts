/**
 * Workers AI に JSON Schema を強制した chat を投げ、valibot で検証した結果を返す。
 *
 * Cloudflare Workers AI binding (`env.AI.run`) を直接叩く。`workers-ai-provider` を
 * 経由しないのは、同プロバイダが OpenAI 互換モデル（例: `openai/gpt-5.4-mini`）に対して
 * `response_format.json_schema.name` を埋めず OpenAI 側で `Missing required parameter`
 * エラーになるためで、ここでは valibot スキーマを `@valibot/to-json-schema` で
 * JSON Schema に変換したものを受け取り、`json_schema.name`/`strict` を明示して送る。
 */
import * as v from "valibot";

/** 各処理フェーズの所要時間（ms）。ボトルネック切り分け用にハンドラ側でログする */
export type ExtractTiming = {
  /** プロンプト構築にかかった時間 */
  promptMs: number;
  /** `env.AI.run` の往復時間。LLM 推論 + ネットワーク + ゲートウェイの合計 */
  aiMs: number;
  /** レスポンスから JSON を抜き出して JSON.parse する時間 */
  parseMs: number;
  /** 抽出結果を valibot で v.parse する時間 */
  validateMs: number;
};

/** Workers AI の binding のうち、ここで使う部分 */
export type AiRunner = {
  run: (
    model: string,
    inputs: Record<string, unknown>,
    options?: { signal?: AbortSignal },
  ) => Promise<unknown>;
};

/**
 * プロンプトに入れる長い文字列を max 文字で切り、切ったことを書き添える。
 */
export const truncate = (text: string, max: number): string =>
  text.length <= max ? text : `${text.slice(0, max)}\n…[truncated ${text.length - max} chars]`;

type WorkersAiChatResponse = {
  response?: unknown;
  choices?: Array<{ message?: { content?: unknown } }>;
  usage?: unknown;
};

/**
 * Workers AI の chat 系レスポンスから assistant メッセージ本体を取り出す。
 */
const extractAssistantPayload = (output: WorkersAiChatResponse): unknown => {
  const choiceContent = output.choices?.[0]?.message?.content;
  if (choiceContent != null && choiceContent !== "") {
    if (typeof choiceContent === "string") {
      return JSON.parse(choiceContent);
    }
    return choiceContent;
  }
  if ("response" in output) {
    const response = output.response;
    if (typeof response === "string") return JSON.parse(response);
    if (response !== null && response !== undefined) return response;
  }
  throw new Error(`Workers AI returned no usable content: ${JSON.stringify(output)}`);
};

/**
 * 出力スキーマを強制して chat を投げ、スキーマで検証した結果を返す。
 */
export const runStructuredChat = async <TSchema extends v.GenericSchema>(params: {
  ai: AiRunner;
  model: string;
  buildPrompt: () => { system: string; prompt: string };
  schemaName: string;
  /** `schema` を `toJsonSchema` で変換したもの。呼び出しごとに変換しないよう呼び出し側で持つ */
  jsonSchema: unknown;
  schema: TSchema;
  abortSignal?: AbortSignal;
}): Promise<{ object: v.InferOutput<TSchema>; usage: unknown; timing: ExtractTiming }> => {
  const tStart = performance.now();
  const { system, prompt } = params.buildPrompt();
  const tAfterPrompt = performance.now();

  const inputs: Record<string, unknown> = {
    messages: [
      { role: "system", content: system },
      { role: "user", content: prompt },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: params.schemaName,
        strict: true,
        schema: params.jsonSchema,
      },
    },
  };
  // chat 系モデルは choices か response を持つオブジェクトを返す（取り出しは extractAssistantPayload が確かめる）
  const output = (await params.ai.run(params.model, inputs, {
    signal: params.abortSignal,
  })) as WorkersAiChatResponse;
  const tAfterAi = performance.now();

  const payload = extractAssistantPayload(output);
  const tAfterParse = performance.now();

  const object = v.parse(params.schema, payload);
  const tAfterValidate = performance.now();

  return {
    object,
    usage: output.usage,
    timing: {
      promptMs: Math.round(tAfterPrompt - tStart),
      aiMs: Math.round(tAfterAi - tAfterPrompt),
      parseMs: Math.round(tAfterParse - tAfterAi),
      validateMs: Math.round(tAfterValidate - tAfterParse),
    },
  };
};
