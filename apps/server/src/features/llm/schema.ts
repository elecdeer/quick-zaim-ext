/**
 * LLM による支払い情報抽出のスキーマ定義。
 *
 * `POST /api/llm/extract-payment` ハンドラと評価スクリプトの両方から再利用する。
 */

import * as v from "valibot";

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
 * `genreId` は品目ごとに推論する（同じ会計でも商品ごとにジャンルが変わり得るため）。
 *
 * OpenAI Structured Outputs の strict モードは object に `additionalProperties: false`
 * を要求する。`v.strictObject` を使うと `@valibot/to-json-schema` が自動で付けてくれる。
 */
export const ExtractedPaymentItemSchema = v.strictObject({
  name: v.nullable(v.string()),
  amount: v.nullable(v.number()),
  comment: v.nullable(v.string()),
  genreId: v.nullable(v.number()),
});

export type ExtractedPaymentItem = v.InferOutput<typeof ExtractedPaymentItemSchema>;

/**
 * LLM に強制させる出力スキーマ。不明な項目は `null` を返させる。
 *
 * 1 回の支払い全体に共通する属性（日付・口座・店舗）はトップレベルに、
 * 品目ごとに変わり得る属性（名称・金額・ジャンル等）は `items` 配列に格納する。
 *
 * `categoryId` は `genreId` から一意に決まるため LLM には推論させない（呼び出し側が
 * categories 一覧から逆引きする）。プロンプトではカテゴリの階層情報を渡して
 * `genreId` 選択の精度を上げる。
 */
export const ExtractedPaymentSchema = v.strictObject({
  date: v.nullable(v.pipe(v.string(), v.regex(/^\d{4}-\d{2}-\d{2}$/))),
  accountId: v.nullable(v.number()),
  place: v.nullable(v.string()),
  items: v.array(ExtractedPaymentItemSchema),
  confidence: v.picklist(["high", "medium", "low"]),
  reasoning: v.string(),
});

export type ExtractedPayment = v.InferOutput<typeof ExtractedPaymentSchema>;

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
