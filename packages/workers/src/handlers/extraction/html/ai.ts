import { valibotSchema } from "@ai-sdk/valibot";
import { type LanguageModel, generateObject } from "ai";
import * as v from "valibot";
import { prompt } from "./prompt";

export const aiExtractionFromHtml = async (
	html: string,
	model: LanguageModel,
) => {
	const { object } = await generateObject({
		model,
		schema: valibotSchema(receiptSchema),
		prompt: prompt(html),
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
			category: v.pipe(v.string(), v.description("商品のカテゴリ")),
			priceYen: v.pipe(v.number(), v.description("商品の金額")),
		}),
	),
	shopName: v.pipe(v.string(), v.description("購入した店舗やサイトの名前")),
	sumPrice: v.pipe(v.number(), v.description("全てのitemの金額の合計")),
	receiptId: v.pipe(
		v.string(),
		v.description("請求書を特定するためのユニークなID"),
	),
});
