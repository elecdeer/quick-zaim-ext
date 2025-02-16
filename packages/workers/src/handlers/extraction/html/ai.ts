import { valibotSchema } from "@ai-sdk/valibot";
import { type LanguageModel, generateObject } from "ai";
import * as v from "valibot";
import { prompt } from "./prompt";

export const aiExtractionFromHtml = async (
	{
		html,
		shops,
		categories,
	}: {
		html: string;
		shops: Shop[];
		categories: Category[];
	},
	model: LanguageModel,
) => {
	const { object } = await generateObject({
		model,
		schema: valibotSchema(receiptSchema),
		prompt: prompt({
			html,
			shops,
			categories,
		}),
	});

	return object;
};

const receiptSchema = v.object({
	date: v.pipe(v.string(), v.description("YYYY-MM-DD形式の購入日")),
	items: v.array(
		v.object({
			name: v.pipe(v.string(), v.description("商品名")),
			normalizedName: v.pipe(
				v.string(),
				v.description("ノイズを取り除いた商品名"),
			),
			amount: v.pipe(v.number(), v.integer(), v.description("商品の個数")),
			category: v.pipe(v.string(), v.description("商品のサブカテゴリ")),
			categoryId: v.pipe(v.string(), v.description("商品のサブカテゴリID")),
			priceYen: v.pipe(v.number(), v.description("商品の金額")),
		}),
	),
	shopName: v.pipe(v.string(), v.description("購入場所の名前")),
	shopId: v.pipe(
		v.nullable(v.string()),
		v.description("購入場所のID 不明な場合はnull"),
	),
	sumPrice: v.pipe(v.number(), v.description("全てのitemの金額の合計")),
	receiptId: v.pipe(
		v.string(),
		v.description("請求書を特定するためのユニークなID"),
	),
});

export type Receipt = v.InferOutput<typeof receiptSchema>;

export type Shop = {
	id: string;
	name: string;
	description?: string | undefined;
};

export type Category = {
	id: string;
	name: string;
	description?: string | undefined;
	subCategories: SubCategory[];
};

export type SubCategory = {
	id: string;
	name: string;
	description?: string | undefined;
};
