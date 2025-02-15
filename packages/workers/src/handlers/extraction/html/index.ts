import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { getAuth } from "@hono/oidc-auth";
import { vValidator } from "@hono/valibot-validator";
import { Hono } from "hono";
import * as v from "valibot";
import { parseEnv } from "../../../env";
import { aiExtractionFromHtml } from "./ai";

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
			},
			model,
		);

		console.log(res);
		return c.json(res);
	},
);
