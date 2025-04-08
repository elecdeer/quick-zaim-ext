import type { Context } from "hono";
import { env } from "hono/adapter";
import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import * as v from "valibot";

const envVarsSchema = v.object({
	OPENAI_API_KEY: v.string(),
	OPENAI_MODEL: v.string(),
	OPENAI_BASE_URL: v.pipe(v.string(), v.url()),

	GEMINI_API_KEY: v.string(),
	GEMINI_BASE_URL: v.pipe(v.string(), v.url()),

	OIDC_AUTH_SECRET: v.string(),
	OIDC_ISSUER: v.string(),
	OIDC_CLIENT_ID: v.string(),
	OIDC_CLIENT_SECRET: v.string(),
	// CHROME_EXTENSION_ID: v.string(),
	ZAIM_CONSUMER_KEY: v.string(),
	ZAIM_CONSUMER_SECRET: v.string(),
	ZAIM_CALLBACK_URL: v.string(),
});

const bindingsSchema = v.object({
	ZAIM_AGENT_ZAIM_TOKENS_KV: v.custom<KVNamespace>(
		(value) => typeof value === "object" && value !== null,
	),
});

const envSchema = v.intersect([envVarsSchema, bindingsSchema]);

export type Env = v.InferOutput<typeof envSchema>;

export const validateEnvMiddleware = createMiddleware(async (c, next) => {
	const envVars = env(c);
	const result = v.safeParse(envVarsSchema, envVars);
	if (!result.success) {
		throw new HTTPException(500, {
			message: "Invalid environment variables",
			cause: {
				issues: result.issues,
			},
		});
	}
	await next();
});
