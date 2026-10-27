/**
 * LLM によるページからの支払い情報の抽出。apps/server/src/features/llm から移したもの。
 * Workers AI の呼び出しは structuredChat.ts にまとめている。
 */
import { toJsonSchema } from "@valibot/to-json-schema";
import * as v from "valibot";
import type { CategoryWithGenres, PlaceWithUsage } from "../ledger/masters.ts";
import {
  runStructuredChat,
  truncate,
  type AiRunner,
  type ExtractTiming,
} from "./structuredChat.ts";

/** 拡張機能の content script が集めたページの内容 */
export const PageContentSchema = v.object({
  url: v.string(),
  title: v.string(),
  ariaSnapshot: v.string(),
  collectedAt: v.string(),
});

export type PageContent = v.InferOutput<typeof PageContentSchema>;

/** プロンプトに渡す、ページの内容と台帳の候補 */
export type ExtractPaymentContext = {
  pageContent: PageContent;
  /** 支出のカテゴリ */
  categories: CategoryWithGenres[];
  accounts: { id: number; name: string }[];
  places: PlaceWithUsage[];
};

/**
 * 抽出された 1 品目分のスキーマ。明細行 1 つに対応する。
 *
 * `genreId` は品目ごとに推論する（同じ会計でも商品ごとにジャンルが変わり得るため）。
 *
 * OpenAI Structured Outputs の strict モードは object に `additionalProperties: false`
 * を要求する。`v.strictObject` を使うと `@valibot/to-json-schema` が自動で付けてくれる。
 */
const ExtractedPaymentItemSchema = v.strictObject({
  name: v.nullable(v.string()),
  amount: v.nullable(v.number()),
  memo: v.nullable(v.string()),
  genreId: v.nullable(v.number()),
});

/**
 * LLM に強制させる出力スキーマ。不明な項目は `null` を返させる。
 *
 * 1 回の支払い全体に共通する属性（日付・口座・店舗）はトップレベルに、
 * 品目ごとに変わり得る属性（名称・金額・内訳等）は `items` 配列に格納する。
 * カテゴリは内訳から一意に決まるため LLM には推論させない。
 */
export const ExtractedPaymentSchema = v.strictObject({
  date: v.nullable(v.pipe(v.string(), v.regex(/^\d{4}-\d{2}-\d{2}$/))),
  accountId: v.nullable(v.number()),
  placeName: v.nullable(v.string()),
  items: v.array(ExtractedPaymentItemSchema),
  confidence: v.picklist(["high", "medium", "low"]),
  reasoning: v.string(),
});

export type ExtractedPayment = v.InferOutput<typeof ExtractedPaymentSchema>;

const ARIA_SNAPSHOT_MAX_CHARS = 16000;
const RECENT_PLACES_LIMIT = 20;

/**
 * カテゴリ一覧を 1 カテゴリ 1 行のコンパクトな形式にまとめる。
 */
export const formatCategoriesForPrompt = (categories: CategoryWithGenres[]): string => {
  if (categories.length === 0) return "(none)";
  return categories
    .map((category) => {
      const genres =
        category.genres.map((genre) => `${genre.id}=${genre.name}`).join(", ") || "(none)";
      return `${category.id}=${category.name}: ${genres}`;
    })
    .join("\n");
};

/**
 * 口座一覧をプロンプト用にフォーマットする。
 */
export const formatAccountsForPrompt = (accounts: ExtractPaymentContext["accounts"]): string => {
  if (accounts.length === 0) return "(none)";
  return accounts.map((account) => `${account.id}=${account.name}`).join(", ");
};

/**
 * 最近使った店舗をプロンプト用にフォーマットする。使ったことのない店舗は候補にしない。
 */
export const formatRecentPlacesForPrompt = (
  places: PlaceWithUsage[],
  limit: number = RECENT_PLACES_LIMIT,
): string => {
  const recent = places.filter((place) => place.lastUsedOn !== null).slice(0, limit);
  if (recent.length === 0) return "(none)";
  return recent
    .map((place) => `${place.name} [${place.useCount}x, ${place.lastUsedOn ?? ""}]`)
    .join("\n");
};

/**
 * LLM へ渡す system / prompt を構築する。
 */
export const buildPrompt = (input: ExtractPaymentContext): { system: string; prompt: string } => {
  const system = [
    "Extract payment info from a web page accessibility snapshot (receipt, order confirmation, invoice, transaction history, etc.) for a household ledger.",
    "",
    "Rules:",
    "- `accountId` must be one of the provided account IDs; otherwise null.",
    '- `date`: "YYYY-MM-DD"; prefer the order/purchase date when several exist.',
    "- `placeName`: use a recent store name as is when it clearly fits, else extract the merchant name from the page.",
    "- `confidence`: high/medium/low based on how clearly the page conveys the payment.",
    "- `reasoning`: 1-3 sentences justifying your choices.",
    "",
    "`items` (one per line item):",
    "- Split itemized receipts/orders into one entry per product; single payments → one item.",
    "- `amount` is the per-item subtotal in JPY (integer); items should sum to the page total when shown. Discounts are separate items with negative amounts.",
    "- `name` is the product/service name; `memo` is a short note (e.g. quantity, variant) only when helpful.",
    "- `genreId` is the per-item genre. Must be one of the provided genre IDs; otherwise null.",
    "  Pick the genre by its parent category context — the listing shows `categoryId=name: genreId=name, ...` so you can see which genres belong to which category.",
    "  Choose the most fitting genre for each item independently; different items in the same purchase may have different genres.",
    "  Do NOT output a category ID; only the per-item `genreId` is required.",
    "  A discount item takes the same `genreId` as the item it discounts. When it applies to the whole purchase, use the genre of the largest item.",
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
    "## Recent stores (format: `name [count, lastUsedOn]`)",
    formatRecentPlacesForPrompt(input.places),
    "",
    "## Page accessibility snapshot",
    "```",
    ariaSnapshot,
    "```",
  ].join("\n");

  return { system, prompt };
};

/** `ExtractedPaymentSchema` を OpenAI 互換の JSON Schema に変換した結果 */
const EXTRACTED_PAYMENT_JSON_SCHEMA = toJsonSchema(ExtractedPaymentSchema);

/**
 * Workers AI binding を使って支払い情報を抽出する。
 */
export const runExtractPayment = (params: {
  ai: AiRunner;
  model: string;
  input: ExtractPaymentContext;
  abortSignal?: AbortSignal;
}): Promise<{ object: ExtractedPayment; usage: unknown; timing: ExtractTiming }> =>
  runStructuredChat({
    ai: params.ai,
    model: params.model,
    buildPrompt: () => buildPrompt(params.input),
    schemaName: "ExtractedPayment",
    jsonSchema: EXTRACTED_PAYMENT_JSON_SCHEMA,
    schema: ExtractedPaymentSchema,
    abortSignal: params.abortSignal,
  });
