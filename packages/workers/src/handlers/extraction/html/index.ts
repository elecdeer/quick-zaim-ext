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
		const env = parseEnv(c.env);

		const { html } = c.req.valid("json");

		const res = await aiExtractionFromHtml(html, env);

		console.log(res);
		return c.json(res);
	},
);
