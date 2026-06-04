/**
 * LLM による支払い情報抽出のスキーマとプロンプト構築。
 *
 * `POST /api/llm/extract-payment` ハンドラと評価スクリプトの両方から再利用するため、
 * バリデーションスキーマと `buildPrompt` をここに集約する。
 */

import { valibotSchema } from "@ai-sdk/valibot";
import { generateText, Output, type LanguageModel } from "ai";
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
 * LLM に強制させる出力スキーマ。不明な項目は `null` を返させる。
 */
export const ExtractedPaymentSchema = v.object({
  amount: v.nullable(v.number()),
  date: v.nullable(v.pipe(v.string(), v.regex(/^\d{4}-\d{2}-\d{2}$/))),
  categoryId: v.nullable(v.number()),
  genreId: v.nullable(v.number()),
  accountId: v.nullable(v.number()),
  place: v.nullable(v.string()),
  comment: v.nullable(v.string()),
  confidence: v.picklist(["high", "medium", "low"]),
  reasoning: v.string(),
});

export type ExtractedPayment = v.InferOutput<typeof ExtractedPaymentSchema>;

const truncate = (text: string, max: number): string =>
  text.length <= max ? text : `${text.slice(0, max)}\n…[truncated ${text.length - max} chars]`;

const formatCategoriesForPrompt = (categories: ExtractPaymentBody["categories"]): string => {
  const paymentCategories = categories.filter((category) => category.mode === "payment");
  if (paymentCategories.length === 0) return "(no payment categories available)";
  return paymentCategories
    .map((category) => {
      const subs = category.subCategories
        .map((sub) => `    - genreId=${sub.id}: ${sub.name}`)
        .join("\n");
      return `- categoryId=${category.id}: ${category.name}\n${subs || "    (no subcategories)"}`;
    })
    .join("\n");
};

const formatAccountsForPrompt = (accounts: ExtractPaymentBody["accounts"]): string => {
  if (accounts.length === 0) return "(no accounts available)";
  return accounts.map((account) => `- accountId=${account.id}: ${account.name}`).join("\n");
};

const formatRecentStoresForPrompt = (stores: ExtractPaymentBody["recentStores"]): string => {
  if (stores.length === 0) return "(no recent stores)";
  return stores
    .slice(0, 30)
    .map(
      (store) =>
        `- ${store.place} (used ${store.count} times, latest ${store.latestDate}, placeUid=${store.placeUid})`,
    )
    .join("\n");
};

/**
 * LLM へ渡す system / prompt を構築する。
 *
 * 純粋関数として実装してテスト・評価スクリプトでも再利用できるようにする。
 */
export const buildPrompt = (input: ExtractPaymentBody): { system: string; prompt: string } => {
  const system = [
    "You are an assistant that extracts payment information from a web page accessibility snapshot.",
    "The page may be a receipt, order confirmation, transaction history, invoice, or similar.",
    "Pick the most likely values for the user's payment registration in Zaim.",
    "",
    "Rules:",
    "- Use only IDs from the provided category/genre/account lists. If unsure, set the field to null.",
    '- `date` must be in "YYYY-MM-DD" format. If multiple dates are present, prefer the order/purchase date.',
    "- `amount` is the total payment amount in JPY (integer).",
    "- `place` should match an existing recent store name when one clearly fits; otherwise extract the store/merchant name from the page.",
    "- `comment` should be a short note (e.g. main item name) only when it adds useful context.",
    "- Set `confidence` to high/medium/low based on how clearly the page conveys the payment.",
    "- Briefly justify your choices in `reasoning` (1-3 sentences).",
  ].join("\n");

  const ariaSnapshot = truncate(input.pageContent.ariaSnapshot, ARIA_SNAPSHOT_MAX_CHARS);

  const prompt = [
    `URL: ${input.pageContent.url}`,
    `Title: ${input.pageContent.title}`,
    `Collected at: ${input.pageContent.collectedAt}`,
    "",
    "## Available payment categories (categoryId / genreId)",
    formatCategoriesForPrompt(input.categories),
    "",
    "## Available accounts",
    formatAccountsForPrompt(input.accounts),
    "",
    "## Recently used stores",
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
 * LanguageModel を使って支払い情報を抽出する。
 *
 * `workers-ai-provider` 公式パターンに合わせ `generateText` + `Output.object` を使う。
 * （`generateObject` は OpenAI/Anthropic 等のネイティブ JSON モード前提で、
 *   Workers AI ではこちらが推奨される構造化出力経路。）
 */
export const runExtractPayment = async (params: {
  model: LanguageModel;
  input: ExtractPaymentBody;
  abortSignal?: AbortSignal;
}): Promise<{ object: ExtractedPayment; usage: unknown }> => {
  const { system, prompt } = buildPrompt(params.input);
  const result = await generateText({
    model: params.model,
    system,
    prompt,
    output: Output.object({ schema: valibotSchema(ExtractedPaymentSchema) }),
    abortSignal: params.abortSignal,
  });
  if (!result.output) {
    throw new Error("LLM returned no structured output");
  }
  return { object: result.output, usage: result.usage };
};
