import OpenAI from "openai";
import * as v from "valibot";
import type { Env } from "../../../env";
import { prompt } from "./prompt";

export const aiExtractionFromHtml = async (
	html: string,
	env: Pick<Env, "OPENAI_API_KEY" | "OPENAI_MODEL" | "OPENAI_BASE_URL">,
) => {
	const { OPENAI_API_KEY, OPENAI_MODEL, OPENAI_BASE_URL } = env;
	const openai = new OpenAI({
		apiKey: OPENAI_API_KEY,
		baseURL: OPENAI_BASE_URL,
	});

	const res = await openai.chat.completions.create({
		model: OPENAI_MODEL,
		messages: [
			{
				role: "system",
				content: [
					{
						text: prompt,
						type: "text",
					},
				],
			},
			{
				role: "user",
				content: [
					{
						text: html,
						type: "text",
					},
				],
			},
		],
		response_format: {
			type: "json_schema",
			json_schema: {
				name: "receipt",
				schema: responseJsonSchema,
				strict: true,
			},
		},
		temperature: 1,
		max_completion_tokens: 2048,
		top_p: 1,
		frequency_penalty: 0,
		presence_penalty: 0,
	});

	const result = res.choices[0].message.content;
	const resultJson = result && JSON.parse(result);

	return v.parse(receiptSchema, resultJson);
};

const receiptSchema = v.object({
	date: v.string(),
	items: v.array(
		v.object({
			name: v.string(),
			amount: v.pipe(v.number(), v.integer()),
			category: v.string(),
			priceYen: v.number(),
		}),
	),
	shopName: v.string(),
	sumPrice: v.number(),
	receiptId: v.string(),
});

const responseJsonSchema = {
	type: "object",
	required: ["shopName", "date", "sumPrice", "receiptId", "items"],
	properties: {
		date: {
			type: "string",
			description: "YYYY-MM-DD形式の購入日",
		},
		items: {
			type: "array",
			items: {
				type: "object",
				required: ["name", "category", "priceYen", "amount"],
				properties: {
					name: {
						type: "string",
						description: "商品名",
					},
					amount: {
						type: "integer",
						description: "商品の個数",
					},
					category: {
						type: "string",
						description: "商品のカテゴリ",
					},
					priceYen: {
						type: "integer",
						description: "商品の金額",
					},
				},
				additionalProperties: false,
			},
			description: "A list of items purchased in the transaction.",
		},
		shopName: {
			type: "string",
			description: "購入した店舗やサイトの名前",
		},
		sumPrice: {
			type: "integer",
			description: "The total price of all items on the receipt.",
		},
		receiptId: {
			type: "string",
			description: "A unique identifier for the receipt.",
		},
	},
	additionalProperties: false,
};
