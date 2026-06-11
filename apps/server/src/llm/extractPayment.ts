/**
 * LLM による支払い情報抽出のスキーマとプロンプト構築。
 *
 * `POST /api/llm/extract-payment` ハンドラと評価スクリプトの両方から再利用するため、
 * バリデーションスキーマと `buildPrompt`／`runExtractPayment` をここに集約する。
 *
 * Cloudflare Workers AI binding (`env.AI.run`) を直接叩く。`workers-ai-provider` を
 * 経由しないのは、同プロバイダが OpenAI 互換モデル（例: `openai/gpt-5.4-mini`）に対して
 * `response_format.json_schema.name` を埋めず OpenAI 側で `Missing required parameter`
 * エラーになるためで、ここでは valibot スキーマを `@valibot/to-json-schema` で
 * JSON Schema に変換し、`json_schema.name`/`strict` を明示して送る。
 */

import type { Ai } from "@cloudflare/workers-types";
import { toJsonSchema } from "@valibot/to-json-schema";
import * as v from "valibot";

const ARIA_SNAPSHOT_MAX_CHARS = 16000;

const CategorySchema = v.object({
  id: v.number(),
  name: v.string(),
  mode: v.picklist(["payment", "income"]),
  subCategories: v.array(
    v.object({
      id: v.number(),
      name: v.string(),
    }),
  ),
});

const AccountSchema = v.object({
  id: v.number(),
  name: v.string(),
});

const RecentStoreSchema = v.object({
  place: v.string(),
  placeUid: v.string(),
  latestDate: v.string(),
  count: v.number(),
});

const PageContentSchema = v.object({
  url: v.string(),
  title: v.string(),
  ariaSnapshot: v.string(),
  collectedAt: v.string(),
});

/**
 * `POST /api/llm/extract-payment` のリクエスト body スキーマ。
 */
export const ExtractPaymentBodySchema = v.object({
  pageContent: PageContentSchema,
  categories: v.array(CategorySchema),
  accounts: v.array(AccountSchema),
  recentStores: v.array(RecentStoreSchema),
});

export type ExtractPaymentBody = v.InferOutput<typeof ExtractPaymentBodySchema>;

/**
 * 抽出された 1 品目分のスキーマ。明細行 1 つに対応する。
 *
 * OpenAI Structured Outputs の strict モードは object に `additionalProperties: false`
 * を要求する。`v.strictObject` を使うと `@valibot/to-json-schema` が自動で付けてくれる。
 */
export const ExtractedPaymentItemSchema = v.strictObject({
  name: v.nullable(v.string()),
  amount: v.nullable(v.number()),
  comment: v.nullable(v.string()),
});

export type ExtractedPaymentItem = v.InferOutput<typeof ExtractedPaymentItemSchema>;

/**
 * LLM に強制させる出力スキーマ。不明な項目は `null` を返させる。
 *
 * 1 回の支払い全体に共通する属性（日付・カテゴリ・口座・店舗）はトップレベルに、
 * 個別の明細は `items` 配列に格納する。
 */
export const ExtractedPaymentSchema = v.strictObject({
  date: v.nullable(v.pipe(v.string(), v.regex(/^\d{4}-\d{2}-\d{2}$/))),
  categoryId: v.nullable(v.number()),
  genreId: v.nullable(v.number()),
  accountId: v.nullable(v.number()),
  place: v.nullable(v.string()),
  items: v.array(ExtractedPaymentItemSchema),
  confidence: v.picklist(["high", "medium", "low"]),
  reasoning: v.string(),
});

export type ExtractedPayment = v.InferOutput<typeof ExtractedPaymentSchema>;

const truncate = (text: string, max: number): string =>
  text.length <= max ? text : `${text.slice(0, max)}\n…[truncated ${text.length - max} chars]`;

const RECENT_STORES_LIMIT = 20;

/**
 * カテゴリ一覧を 1 カテゴリ 1 行のコンパクトな形式にまとめる。
 *
 * 1 カテゴリ + サブカテゴリで 6 行以上消費していた旧形式に比べ、
 * トークン消費を概ね半分以下に削減できる。
 */
const formatCategoriesForPrompt = (categories: ExtractPaymentBody["categories"]): string => {
  const paymentCategories = categories.filter((category) => category.mode === "payment");
  if (paymentCategories.length === 0) return "(none)";
  return paymentCategories
    .map((category) => {
      const subs =
        category.subCategories.map((sub) => `${sub.id}=${sub.name}`).join(", ") || "(none)";
      return `${category.id}=${category.name}: ${subs}`;
    })
    .join("\n");
};

const formatAccountsForPrompt = (accounts: ExtractPaymentBody["accounts"]): string => {
  if (accounts.length === 0) return "(none)";
  return accounts.map((account) => `${account.id}=${account.name}`).join(", ");
};

const formatRecentStoresForPrompt = (stores: ExtractPaymentBody["recentStores"]): string => {
  if (stores.length === 0) return "(none)";
  return stores
    .slice(0, RECENT_STORES_LIMIT)
    .map((store) => `${store.place} [uid=${store.placeUid}, ${store.count}x, ${store.latestDate}]`)
    .join("\n");
};

/**
 * LLM へ渡す system / prompt を構築する。
 *
 * 純粋関数として実装してテスト・評価スクリプトでも再利用できるようにする。
 */
export const buildPrompt = (input: ExtractPaymentBody): { system: string; prompt: string } => {
  const system = [
    "Extract payment info from a web page accessibility snapshot (receipt, order confirmation, invoice, transaction history, etc.) for Zaim registration.",
    "",
    "Rules:",
    "- IDs must come from the provided categories/genres/accounts; otherwise null.",
    '- `date`: "YYYY-MM-DD"; prefer the order/purchase date when several exist.',
    "- `place`: match a recent store when it clearly fits, else extract the merchant name from the page.",
    "- `confidence`: high/medium/low based on how clearly the page conveys the payment.",
    "- `reasoning`: 1-3 sentences justifying your choices.",
    "",
    "`items` (one per line item):",
    "- Split itemized receipts/orders into one entry per product; single payments → one item.",
    "- `amount` is the per-item subtotal in JPY (integer); items should sum to the page total when shown.",
    "- `name` is the product/service name; `comment` is a short note (e.g. quantity, variant) only when helpful.",
    "- Use null for fields that cannot be determined.",
    "- `items` is never empty; include at least one entry even if every field is null.",
  ].join("\n");

  const ariaSnapshot = truncate(input.pageContent.ariaSnapshot, ARIA_SNAPSHOT_MAX_CHARS);

  const prompt = [
    `URL: ${input.pageContent.url}`,
    `Title: ${input.pageContent.title}`,
    `Collected at: ${input.pageContent.collectedAt}`,
    "",
    "## Categories (format: `categoryId=name: genreId=name, ...`)",
    formatCategoriesForPrompt(input.categories),
    "",
    "## Accounts (format: `accountId=name, ...`)",
    formatAccountsForPrompt(input.accounts),
    "",
    "## Recent stores (format: `name [uid=placeUid, count, latestDate]`)",
    formatRecentStoresForPrompt(input.recentStores),
    "",
    "## Page accessibility snapshot",
    "```",
    ariaSnapshot,
    "```",
  ].join("\n");

  return { system, prompt };
};

/**
 * `ExtractedPaymentSchema` を OpenAI 互換の JSON Schema に変換した結果をキャッシュする。
 * 毎回ビルドする必要はないため module スコープで一度だけ計算する。
 */
const EXTRACTED_PAYMENT_JSON_SCHEMA = toJsonSchema(ExtractedPaymentSchema);

interface WorkersAiChatResponse {
  response?: unknown;
  choices?: Array<{ message?: { content?: unknown } }>;
  usage?: unknown;
}

/**
 * Workers AI の chat 系レスポンスから assistant メッセージ本体を取り出す。
 *
 * OpenAI 互換モデルは `choices[0].message.content` を返し、Workers AI ネイティブ
 * モデルは `response` を返す。さらに `json_schema` 指定時は文字列ではなくパース済み
 * オブジェクトで返るケースがあるため、両ケースを正規化する。
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
 * 各処理フェーズの所要時間（ms）。ボトルネック切り分け用にハンドラ側でログする。
 */
export interface ExtractPaymentTiming {
  /** プロンプト構築（buildPrompt）にかかった時間 */
  promptMs: number;
  /** `env.AI.run` の往復時間。LLM 推論 + ネットワーク + ゲートウェイの合計 */
  aiMs: number;
  /** レスポンスから JSON を抜き出して JSON.parse する時間 */
  parseMs: number;
  /** 抽出結果を valibot で v.parse する時間 */
  validateMs: number;
}

/**
 * Workers AI binding を使って支払い情報を抽出する。
 *
 * `env.AI.run(model, ...)` を直接呼び出し、OpenAI Structured Outputs の
 * `response_format.json_schema` に valibot 由来の JSON Schema を渡す。
 *
 * 戻り値にはフェーズごとの所要時間（`timing`）を含める。ハンドラ側でこれを
 * 構造化ログに出すことで「5 秒のうち ai.run が何 ms、parse が何 ms」を即時に
 * 切り分けられる。
 */
export const runExtractPayment = async (params: {
  ai: Ai;
  model: string;
  input: ExtractPaymentBody;
  abortSignal?: AbortSignal;
}): Promise<{ object: ExtractedPayment; usage: unknown; timing: ExtractPaymentTiming }> => {
  const tStart = performance.now();
  const { system, prompt } = buildPrompt(params.input);
  const tAfterPrompt = performance.now();

  const inputs: Record<string, unknown> = {
    messages: [
      { role: "system", content: system },
      { role: "user", content: prompt },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "ExtractedPayment",
        strict: true,
        schema: EXTRACTED_PAYMENT_JSON_SCHEMA,
      },
    },
  };
  const output: WorkersAiChatResponse = await params.ai.run(params.model, inputs, {
    signal: params.abortSignal,
  });
  const tAfterAi = performance.now();

  const payload = extractAssistantPayload(output);
  const tAfterParse = performance.now();

  const object = v.parse(ExtractedPaymentSchema, payload);
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
