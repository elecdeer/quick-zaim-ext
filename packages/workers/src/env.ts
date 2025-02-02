import * as v from "valibot";

const envSchema = v.object({
	OPENAI_API_KEY: v.string(),
	OPENAI_MODEL: v.string(),
	OPENAI_BASE_URL: v.pipe(v.string(), v.url()),
	OIDC_AUTH_SECRET: v.string(),
	OIDC_ISSUER: v.string(),
	OIDC_CLIENT_ID: v.string(),
	OIDC_CLIENT_SECRET: v.string(),
	CHROME_EXTENSION_ID: v.string(),
});

export type Env = v.InferOutput<typeof envSchema>;

export const parseEnv = (env: unknown): Env => {
	const result = v.safeParse(envSchema, env);
	if (!result.success) {
		throw new Error(result.issues.map((i) => i.message).join("\n"));
	}
	return result.output;
};
