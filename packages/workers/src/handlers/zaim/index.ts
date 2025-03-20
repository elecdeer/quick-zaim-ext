import { vValidator } from "@hono/valibot-validator";
import {
	createOAuthSigner,
	fetchAccessToken,
	fetchRequestToken,
} from "@repo/oauth";
import { client, userVerifyUser } from "@repo/zaim-api/client";
import { Hono } from "hono";
import * as v from "valibot";
import { parseEnv } from "../../env";

export const zaimRoute = new Hono<{
	Bindings: {
		MY_KV_NAMESPACE: KVNamespace;
	};
}>();

const zaimOAuthEndpoints = {
	accessTokenEndpoint: {
		url: "https://api.zaim.net/v2/auth/access",
		method: "GET",
	},
	requestTokenEndpoint: {
		url: "https://api.zaim.net/v2/auth/request",
		method: "GET",
	},
	authorizeEndpoint: {
		url: "https://auth.zaim.net/users/auth",
	},
} as const;

zaimRoute.get(
	"/login",

	async (c) => {
		const env = parseEnv(c.env);

		const requestToken = await fetchRequestToken({
			requestTokenEndpoint: zaimOAuthEndpoints.requestTokenEndpoint,
			consumerKey: env.ZAIM_CONSUMER_KEY,
			consumerSecret: env.ZAIM_CONSUMER_SECRET,
			callbackUrl: env.ZAIM_CALLBACK_URL,
		});

		const userAuthorizeUrl = `${zaimOAuthEndpoints.authorizeEndpoint.url}?oauth_token=${requestToken.oauthToken}`;

		await c.env.MY_KV_NAMESPACE.put(
			"requestToken",
			JSON.stringify(requestToken),
		);

		return c.json({ userAuthorizeUrl });
	},
);

zaimRoute.get(
	"/callback",
	vValidator(
		"query",
		v.object({
			oauth_token: v.string(),
			oauth_verifier: v.string(),
		}),
	),
	async (c) => {
		const env = parseEnv(c.env);

		console.log(c.req.valid("query").oauth_token);
		console.log(c.req.valid("query").oauth_verifier);

		const requestToken = JSON.parse(
			(await c.env.MY_KV_NAMESPACE.get("requestToken")) ?? "",
		);

		const accessToken = await fetchAccessToken({
			accessTokenEndpoint: zaimOAuthEndpoints.accessTokenEndpoint,
			consumerKey: env.ZAIM_CONSUMER_KEY,
			consumerSecret: env.ZAIM_CONSUMER_SECRET,
			oauthVerifier: c.req.valid("query").oauth_verifier,
			requestToken: requestToken,
		});
		console.log(accessToken);

		const signer = createOAuthSigner({
			accessToken: accessToken.accessToken,
			accessTokenSecret: accessToken.accessTokenSecret,
			consumerKey: env.ZAIM_CONSUMER_KEY,
			consumerSecret: env.ZAIM_CONSUMER_SECRET,
		});

		client.setConfig({
			baseUrl: "https://api.zaim.net/",
		});
		client.interceptors.request.use((req) => {
			console.log(req.url);
			return signer(req);
		});

		const user = await userVerifyUser();

		return c.json({ user });
	},
);
