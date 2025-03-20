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

import { createDb, requestTokenRepository } from "../../db";

export const zaimRoute = new Hono<{
	Bindings: {
		MY_KV_NAMESPACE: KVNamespace;
		DB: D1Database;
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

zaimRoute.get("/login", async (c) => {
	const env = parseEnv(c.env);

	const requestToken = await fetchRequestToken({
		requestTokenEndpoint: zaimOAuthEndpoints.requestTokenEndpoint,
		consumerKey: env.ZAIM_CONSUMER_KEY,
		consumerSecret: env.ZAIM_CONSUMER_SECRET,
		callbackUrl: env.ZAIM_CALLBACK_URL,
	});

	const userAuthorizeUrl = `${zaimOAuthEndpoints.authorizeEndpoint.url}?oauth_token=${requestToken.oauthToken}`;

	// D1データベースに接続
	const db = createDb(c.env.DB);

	// requestTokenを保存
	await requestTokenRepository.saveRequestToken(db, {
		oauthToken: requestToken.oauthToken,
		oauthTokenSecret: requestToken.oauthTokenSecret,
	});

	return c.json({ userAuthorizeUrl });
});

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

		// D1データベースに接続
		const db = createDb(c.env.DB);

		// requestTokenを取得
		const requestToken = await requestTokenRepository.getRequestToken(
			db,
			c.req.valid("query").oauth_token,
		);

		if (!requestToken) {
			return c.json({ error: "Request token not found" }, 404);
		}

		const accessToken = await fetchAccessToken({
			accessTokenEndpoint: zaimOAuthEndpoints.accessTokenEndpoint,
			consumerKey: env.ZAIM_CONSUMER_KEY,
			consumerSecret: env.ZAIM_CONSUMER_SECRET,
			oauthVerifier: c.req.valid("query").oauth_verifier,
			requestToken: requestToken,
		});
		console.log(accessToken);

		// 使用済みのrequestTokenを削除
		await requestTokenRepository.deleteRequestToken(
			db,
			c.req.valid("query").oauth_token,
		);

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
