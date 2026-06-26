/**
 * LLM による支払い情報抽出のロジック。
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
import {
  ExtractedPaymentSchema,
  type ExtractPaymentBody,
  type ExtractedPayment,
  type ExtractPaymentTiming,
} from "./schema.ts";

const ARIA_SNAPSHOT_MAX_CHARS = 16000;
const RECENT_STORES_LIMIT = 20;

const truncate = (text: string, max: number): string =>
  text.length <= max ? text : `${text.slice(0, max)}\n…[truncated ${text.length - max} chars]`;

/**
 * カテゴリ一覧を 1 カテゴリ 1 行のコンパクトな形式にまとめる。
 */
export const formatCategoriesForPrompt = (categories: ExtractPaymentBody["categories"]): string => {
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

/**
 * 口座一覧をプロンプト用にフォーマットする。
 */
export const formatAccountsForPrompt = (accounts: ExtractPaymentBody["accounts"]): string => {
  if (accounts.length === 0) return "(none)";
  return accounts.map((account) => `${account.id}=${account.name}`).join(", ");
};

/**
 * 最近の店舗一覧をプロンプト用にフォーマットする。
 */
export const formatRecentStoresForPrompt = (stores: ExtractPaymentBody["recentStores"]): string => {
  if (stores.length === 0) return "(none)";
  return stores
    .slice(0, RECENT_STORES_LIMIT)
    .map((store) => `${store.place} [uid=${store.placeUid}, ${store.count}x, ${store.latestDate}]`)
    .join("\n");
};

/**
 * LLM へ渡す system / prompt を構築する。
 */
export const buildPrompt = (input: ExtractPaymentBody): { system: string; prompt: string } => {
  const system = [
    "Extract payment info from a web page accessibility snapshot (receipt, order confirmation, invoice, transaction history, etc.) for Zaim registration.",
    "",
    "Rules:",
    "- `accountId` must be one of the provided account IDs; otherwise null.",
    '- `date`: "YYYY-MM-DD"; prefer the order/purchase date when several exist.',
    "- `place`: match a recent store when it clearly fits, else extract the merchant name from the page.",
    "- `confidence`: high/medium/low based on how clearly the page conveys the payment.",
    "- `reasoning`: 1-3 sentences justifying your choices.",
    "",
    "`items` (one per line item):",
    "- Split itemized receipts/orders into one entry per product; single payments → one item.",
    "- `amount` is the per-item subtotal in JPY (integer); items should sum to the page total when shown.",
    "- `name` is the product/service name; `comment` is a short note (e.g. quantity, variant) only when helpful.",
    "- `genreId` is the per-item genre. Must be one of the provided sub-category IDs; otherwise null.",
    "  Pick the genre by its parent category context — the listing shows `categoryId=name: genreId=name, ...` so you can see which genres belong to which category.",
    "  Choose the most fitting genre for each item independently; different items in the same purchase may have different genres.",
    "  Do NOT output a category ID; only the per-item `genreId` is required.",
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
 */
const EXTRACTED_PAYMENT_JSON_SCHEMA = toJsonSchema(ExtractedPaymentSchema);

interface WorkersAiChatResponse {
  response?: unknown;
  choices?: Array<{ message?: { content?: unknown } }>;
  usage?: unknown;
}

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
 * Workers AI binding を使って支払い情報を抽出する。
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
