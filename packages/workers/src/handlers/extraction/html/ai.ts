import { valibotSchema } from "@ai-sdk/valibot";
import { type LanguageModel, generateObject, generateText, tool } from "ai";
import * as v from "valibot";
import { prompt } from "./prompt";

export const aiExtractionFromHtml = async (
	html: string,
	model: LanguageModel,
) => {
	// const { object } = await generateObject({
	// 	model,
	// 	schema: valibotSchema(receiptSchema),
	// 	prompt: prompt(html),
	// });

	// return object;

	let result: v.InferOutput<typeof receiptSchema> | null = null;

	const response = await generateText({
		model,
		prompt: prompt(html),
		maxSteps: 5,
		tools: {
			searchShop: tool({
				description: "購入した店舗やサイトの検索",
				parameters: valibotSchema(
					v.object({
						searchText: v.string(),
					}),
				),
				execute: async ({
					searchText,
				}): Promise<{ id: string; name: string }[]> => {
					console.log("searchShop", searchText);
					await new Promise((resolve) => setTimeout(resolve, 100));
					return [
						{
							id: "19285109",
							name: "Amazon.co.jp",
						},
						{
							id: "41917412",
							name: "Amazon.com",
						},
						{
							id: "1912410",
							name: "Yodobashi.com",
						},
					];
				},
			}),
			result: tool({
				description: "結果を出力する",
				parameters: valibotSchema(receiptSchema),
				// biome-ignore lint/suspicious/useAwait: <explanation>
				execute: async (receipt) => {
					result = receipt;
					return "accepted";
				},
			}),
		},
	});

	console.warn(result);
	console.log(response);

	return response;
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
	shopId: v.pipe(v.string(), v.description("searchShopによって得たId")),
	sumPrice: v.pipe(v.number(), v.description("全てのitemの金額の合計")),
	receiptId: v.pipe(
		v.string(),
		v.description("請求書を特定するためのユニークなID"),
	),
});
