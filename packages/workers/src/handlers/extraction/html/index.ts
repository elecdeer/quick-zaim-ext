import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { getAuth } from "@hono/oidc-auth";
import { vValidator } from "@hono/valibot-validator";
import { Hono } from "hono";
import * as v from "valibot";
import { parseEnv } from "../../../env";
import { type Category, aiExtractionFromHtml } from "./ai";

export const extractionHtmlRoute = new Hono();

extractionHtmlRoute.post(
	"/",
	vValidator(
		"json",
		v.object({
			html: v.string(),
		}),
	),
	async (c) => {
		const auth = await getAuth(c);
		if (auth === null) {
			return c.json({ error: "Unauthorized" }, 401);
		}

		const env = parseEnv(c.env);

		const { html } = c.req.valid("json");

		const google = createGoogleGenerativeAI({
			apiKey: env.GEMINI_API_KEY,
			baseURL: env.GEMINI_BASE_URL,
		});
		const model = google("gemini-2.0-flash-001");

		// const openai = createOpenAI({
		// 	apiKey: env.OPENAI_API_KEY,
		// 	baseURL: env.OPENAI_BASE_URL,
		// });
		// const model = openai("gpt-4o-mini");

		const res = await aiExtractionFromHtml(
			{
				html,
				shops: [
					{ id: "19285109", name: "Amazon.co.jp" },
					{ id: "41917412", name: "Amazon.com" },
					{ id: "1912410", name: "Yodobashi.com" },
				],
				categories: tempCategory,
			},
			model,
		);

		console.log(res);
		return c.json(res);
	},
);

// TODO: APIから取る
const tempCategory: Category[] = [
	{
		id: "101",
		name: "食費",
		description: undefined,
		subCategories: [
			{ id: "10101", name: "食料品", description: undefined },
			{ id: "10105", name: "惣菜・外食", description: undefined },
			{ id: "10104", name: "昼ご飯", description: undefined },
			{ id: "31960852", name: "珈琲", description: undefined },
			{ id: "10199", name: "晩酌", description: undefined },
			{ id: "31852113", name: "おやつ", description: undefined },
		],
	},
	{
		id: "102",
		name: "日用雑貨",
		description: undefined,
		subCategories: [
			{ id: "10201", name: "消耗品", description: undefined },
			{ id: "31910082", name: "雑貨", description: undefined },
			{ id: "10299", name: "その他", description: undefined },
		],
	},
	{
		id: "108",
		name: "エンタメ",
		description: undefined,
		subCategories: [
			{ id: "10807", name: "ゲーム", description: undefined },
			{ id: "32109043", name: "ガジェット", description: undefined },
			{ id: "10805", name: "漫画", description: undefined },
			{ id: "10806", name: "書籍", description: undefined },
			{ id: "32056786", name: "工作", description: undefined },
			{ id: "10801", name: "レジャー", description: undefined },
			{ id: "10802", name: "イベント", description: undefined },
			{ id: "10803", name: "映画・動画", description: undefined },
			{ id: "10899", name: "その他", description: undefined },
		],
	},
	{
		id: "111",
		name: "美容・衣服",
		description: undefined,
		subCategories: [
			{ id: "11101", name: "洋服", description: undefined },
			{ id: "11102", name: "アクセサリー・小物", description: undefined },
			{ id: "11104", name: "ジム・健康", description: undefined },
			{ id: "11105", name: "美容院", description: undefined },
			{ id: "11199", name: "その他", description: undefined },
		],
	},
	{
		id: "107",
		name: "交際費",
		description: undefined,
		subCategories: [
			{ id: "10701", name: "飲み会", description: undefined },
			{ id: "10702", name: "プレゼント", description: undefined },
			{ id: "10703", name: "ご祝儀・香典", description: undefined },
			{ id: "10799", name: "その他", description: undefined },
			{ id: "33982807", name: "お土産", description: undefined },
		],
	},
	{
		id: "110",
		name: "医療・保険",
		description: undefined,
		subCategories: [
			{ id: "11001", name: "病院代", description: undefined },
			{ id: "11002", name: "薬代", description: undefined },
			{ id: "11003", name: "生命保険", description: undefined },
			{ id: "11004", name: "医療保険", description: undefined },
			{ id: "11099", name: "その他", description: undefined },
		],
	},
	{
		id: "103",
		name: "交通",
		description: undefined,
		subCategories: [
			{ id: "10301", name: "電車", description: undefined },
			{ id: "10302", name: "タクシー", description: undefined },
			{ id: "10303", name: "バス", description: undefined },
			{ id: "10304", name: "飛行機", description: undefined },
			{ id: "10399", name: "その他", description: undefined },
		],
	},
	{
		id: "104",
		name: "通信",
		description: undefined,
		subCategories: [
			{ id: "10401", name: "携帯電話料金", description: undefined },
			{ id: "10402", name: "固定電話料金", description: undefined },
			{ id: "10403", name: "インターネット関連費", description: undefined },
			{ id: "10405", name: "宅配便", description: undefined },
			{ id: "10406", name: "切手・はがき", description: undefined },
			{ id: "10499", name: "その他", description: undefined },
		],
	},
	{
		id: "106",
		name: "住まい",
		description: undefined,
		subCategories: [
			{ id: "10601", name: "家賃", description: undefined },
			{ id: "10602", name: "住宅ローン返済", description: undefined },
			{ id: "10603", name: "家具", description: undefined },
			{ id: "10604", name: "家電", description: undefined },
			{ id: "10605", name: "リフォーム", description: undefined },
			{ id: "10606", name: "住宅保険", description: undefined },
			{ id: "10699", name: "その他", description: undefined },
		],
	},
	{
		id: "105",
		name: "水道・光熱",
		description: undefined,
		subCategories: [
			{ id: "10501", name: "水道料金", description: undefined },
			{ id: "10502", name: "電気料金", description: undefined },
			{ id: "10503", name: "ガス料金", description: undefined },
			{ id: "10599", name: "その他", description: undefined },
		],
	},
	{
		id: "114",
		name: "大型出費",
		description: undefined,
		subCategories: [
			{ id: "11401", name: "旅行", description: undefined },
			{ id: "11402", name: "住宅", description: undefined },
			{ id: "11403", name: "自動車", description: undefined },
			{ id: "11404", name: "バイク", description: undefined },
			{ id: "11405", name: "結婚", description: undefined },
			{ id: "11406", name: "出産", description: undefined },
			{ id: "11407", name: "介護", description: undefined },
			{ id: "11408", name: "家具", description: undefined },
			{ id: "11409", name: "家電", description: undefined },
			{ id: "11499", name: "その他", description: undefined },
		],
	},
	{
		id: "46910299",
		name: "引き出し",
		description: undefined,
		subCategories: [
			{ id: "28105916", name: "諸経費", description: undefined },
			{ id: "28105937", name: "学費", description: undefined },
			{ id: "28105939", name: "大きい買い物", description: undefined },
		],
	},
	{
		id: "46910306",
		name: "デビットカード",
		description: undefined,
		subCategories: [
			{ id: "28105950", name: "娯楽費", description: undefined },
			{ id: "28105953", name: "固定費", description: undefined },
		],
	},
	{
		id: "199",
		name: "その他",
		description: undefined,
		subCategories: [
			{ id: "19901", name: "仕送り", description: undefined },
			{ id: "19902", name: "お小遣い", description: undefined },
			{ id: "19903", name: "使途不明金", description: undefined },
			{ id: "19904", name: "立替金", description: undefined },
			{ id: "19905", name: "未分類", description: undefined },
			{ id: "19906", name: "現金の引出", description: undefined },
			{ id: "19999", name: "その他", description: undefined },
			{ id: "19907", name: "カードの引落", description: undefined },
			{ id: "19908", name: "電子マネーにチャージ", description: undefined },
			{ id: "32857134", name: "投資信託", description: undefined },
		],
	},
];
