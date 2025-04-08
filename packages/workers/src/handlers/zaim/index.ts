import { vValidator } from "@hono/valibot-validator";
import { Hono } from "hono";
import * as v from "valibot";

import { getAuth } from "@hono/oidc-auth";
import { getZaimCategories } from "../../services/zaim/getZaimCategories";
import { getZaimPaymentMethods } from "../../services/zaim/getZaimPaymentMethods";
import {
	checkZaimTokenExists,
	getZaimAccessToken, // Import getZaimAccessToken
	getZaimLoginUrl,
	handleZaimCallback,
} from "../../services/zaim/zaimAuth";
import type { HonoApp } from "../../workers";

declare module "hono" {
	interface OidcAuthClaims {
		email: string;
		sub: string;
	}
}

export const zaimRoute = new Hono<HonoApp>();

zaimRoute.get("/login", async (c) => {
	// const env = parseEnv(c.env);
	// const db = createDb(c.env.DB); // dbは不要になった

	try {
		const { userAuthorizeUrl } = await getZaimLoginUrl(c.env); // Use imported function
		return c.json({ userAuthorizeUrl });
	} catch (error) {
		console.error("Failed to get Zaim login URL:", error);
		// エラーの種類に応じて適切なステータスコードを返す
		return c.json({ error: "Failed to initiate Zaim login" }, 500);
	}
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
		const { oauth_token, oauth_verifier } = c.req.valid("query");

		try {
			// OIDCの認証情報を取得
			const auth = await getAuth(c);
			const oidcSub = auth?.sub;

			const { user } = await handleZaimCallback(
				// Use imported function
				c.env,
				oauth_token,
				oauth_verifier,
				oidcSub,
			);

			// 成功した場合、ユーザー情報を返す
			// TODO: 成功後にリダイレクトするなど、フロントエンドの挙動に合わせる必要あり
			return c.json({ user });
		} catch (error) {
			console.error("Failed to handle Zaim callback:", error);
			// エラーの種類に応じて適切なステータスコードとメッセージを返す
			if (
				error instanceof Error &&
				error.message === "Request token not found"
			) {
				return c.json({ error: "Invalid or expired request token" }, 404);
			}
			if (
				error instanceof Error &&
				error.message === "Failed to verify Zaim user"
			) {
				return c.json({ error: "Failed to verify Zaim user account" }, 502); // Bad Gateway or similar
			}
			return c.json({ error: "Failed to process Zaim callback" }, 500);
		}
	},
);

// OIDCのsubに紐づくZaimのアクセストークンの存在を確認するエンドポイント
zaimRoute.get("/token", async (c) => {
	// OIDCの認証情報を取得
	const auth = await getAuth(c);
	if (!auth?.sub) {
		// sub の存在のみチェック
		return c.json({ error: "Unauthorized" }, 401);
	}

	// const db = createDb(c.env.DB); // dbは不要

	try {
		const hasToken = await checkZaimTokenExists(c.env, auth.sub); // Use imported function

		if (hasToken) {
			return c.json({
				status: "success",
				message: "Zaim access token found",
				hasToken: true,
			});
		}
		return c.json(
			{ error: "Zaim access token not found", hasToken: false },
			404,
		);
	} catch (error) {
		console.error("Failed to check Zaim token existence:", error);
		return c.json({ error: "Failed to check Zaim token status" }, 500);
	}
});

// カテゴリとジャンル（サブカテゴリ）を取得するエンドポイント
zaimRoute.get("/categories", async (c) => {
	// const env = parseEnv(c.env); // zaimService内でパースするので不要
	// const db = createDb(c.env.DB); // dbは不要

	// OIDCの認証情報を取得
	const auth = await getAuth(c);
	if (!auth?.sub) {
		return c.json({ error: "Unauthorized" }, 401);
	}

	try {
		// Get access token first
		const { accessToken, accessTokenSecret } = await getZaimAccessToken(
			c.env,
			auth.sub,
		);
		const categories = await getZaimCategories({
			// Use imported function and pass tokens
			env: c.env,
			oidcSub: auth.sub,
			accessToken,
			accessTokenSecret,
		});
		return c.json({ categories });
	} catch (error) {
		console.error("Failed to get Zaim categories:", error);
		if (
			error instanceof Error &&
			error.message.includes("Zaim access token not found")
		) {
			return c.json({ error: "Zaim access token not found" }, 404);
		}
		if (
			error instanceof Error &&
			error.message.includes("Failed to call Zaim API")
		) {
			return c.json({ error: "Failed to call Zaim API" }, 502); // Bad Gateway or similar
		}
		return c.json({ error: "Failed to retrieve categories" }, 500);
	}
});

// 支払い方法（アカウント）を取得するエンドポイント
zaimRoute.get("/payment-methods", async (c) => {
	// const env = parseEnv(c.env); // zaimService内でパースするので不要
	// const db = createDb(c.env.DB); // dbは不要

	// OIDCの認証情報を取得
	const auth = await getAuth(c);
	if (!auth?.sub) {
		return c.json({ error: "Unauthorized" }, 401);
	}

	try {
		// Get access token first
		const { accessToken, accessTokenSecret } = await getZaimAccessToken(
			c.env,
			auth.sub,
		);
		const paymentMethods = await getZaimPaymentMethods({
			// Use imported function and pass tokens
			env: c.env,
			oidcSub: auth.sub,
			accessToken,
			accessTokenSecret,
		});
		return c.json({ paymentMethods });
	} catch (error) {
		console.error("Failed to get Zaim payment methods:", error);
		if (
			error instanceof Error &&
			error.message.includes("Zaim access token not found")
		) {
			return c.json({ error: "Zaim access token not found" }, 404);
		}
		if (
			error instanceof Error &&
			error.message.includes("Failed to call Zaim API")
		) {
			return c.json({ error: "Failed to call Zaim API" }, 502); // Bad Gateway or similar
		}
		return c.json({ error: "Failed to retrieve payment methods" }, 500);
	}
});
