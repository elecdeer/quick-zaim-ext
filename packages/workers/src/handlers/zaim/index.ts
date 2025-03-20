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

import { createDb, accessTokenRepository, requestTokenRepository } from "../../db";
import { getAuth } from "@hono/oidc-auth";

declare module 'hono' {
  interface OidcAuthClaims {
    email: string
    sub: string
  }
}

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

		// OIDCの認証情報を取得
		const auth = await getAuth(c);
    
		if (auth?.sub) {
			// OIDCのsubとZaimのaccessTokenを紐付けて保存
			await accessTokenRepository.saveAccessToken(db, {
				sub: auth.sub,
				accessToken: accessToken.accessToken,
				accessTokenSecret: accessToken.accessTokenSecret,
			});
			console.log(`Saved access token for user: ${auth.sub}`);
		} else {
			console.log("No OIDC auth information available");
		}

		return c.json({ user });
	},
);

// OIDCのsubに紐づくZaimのアクセストークンを取得するエンドポイント
zaimRoute.get("/token", async (c) => {
	// OIDCの認証情報を取得
	const auth = await getAuth(c);
	if (!auth || !auth.sub || typeof auth.sub !== "string") {
		return c.json({ error: "Unauthorized or invalid user" }, 401);
	}

	// D1データベースに接続
	const db = createDb(c.env.DB);

	// アクセストークンを取得
	const token = await accessTokenRepository.getAccessToken(db, auth.sub);
	if (!token) {
		return c.json({ error: "Zaim access token not found" }, 404);
	}

  console.log("token", token);

	return c.json({
		status: "success",
		message: "Zaim access token found",
		// トークン自体は返さない（セキュリティ上の理由）
		hasToken: true
	});
});

// OIDCのsubに紐づくZaimのアクセストークンを使用してAPIを呼び出すエンドポイント
// zaimRoute.get("/api/*", async (c) => {
// 	const env = parseEnv(c.env);
	
// 	// OIDCの認証情報を取得
// 	const auth = await getAuth(c);
// 	if (!auth || !auth.sub || typeof auth.sub !== "string") {
// 		return c.json({ error: "Unauthorized or invalid user" }, 401);
// 	}

// 	// D1データベースに接続
// 	const db = createDb(c.env.DB);

// 	// アクセストークンを取得
// 	const token = await accessTokenRepository.getAccessToken(db, auth.sub);
// 	if (!token) {
// 		return c.json({ error: "Zaim access token not found" }, 404);
// 	}

// 	// Zaimクライアントの設定
// 	const signer = createOAuthSigner({
// 		accessToken: token.accessToken,
// 		accessTokenSecret: token.accessTokenSecret,
// 		consumerKey: env.ZAIM_CONSUMER_KEY,
// 		consumerSecret: env.ZAIM_CONSUMER_SECRET,
// 	});

// 	client.setConfig({
// 		baseUrl: "https://api.zaim.net/",
// 	});
// 	client.interceptors.request.use((req) => {
// 		console.log(req.url);
// 		return signer(req);
// 	});

// 	// パスからAPIエンドポイントを取得
// 	const path = c.req.path.replace(/^\/zaim\/api\//, "");
	
// 	try {
// 		// Zaimクライアントを使用してAPIを呼び出す
// 		// 例として、ユーザー情報を取得する
// 		if (path === "home" || path === "") {
// 			const user = await userVerifyUser();
// 			return c.json(user);
// 		} else {
// 			// 他のAPIエンドポイントは実装が必要
// 			return c.json({
// 				error: "Not implemented",
// 				message: `API endpoint '${path}' is not implemented yet`
// 			}, 501);
// 		}
// 	} catch (error) {
// 		console.error("Zaim API error:", error);
// 		return c.json({ error: "Failed to call Zaim API" }, 500);
// 	}
// });
