import { vValidator } from "@hono/valibot-validator";
import { Hono } from "hono";
import * as v from "valibot";
import { getUserId } from "../../auth";
import * as logger from "../../logger";
import { isErr, match } from "../../result";
import {
	getUserZaimClient,
	getZaimLoginUrl,
	handleZaimCallback,
} from "../../services/zaim/zaimAuth";
import { getZaimCategories } from "../../services/zaim/zaimCategories";
import { getZaimPayments } from "../../services/zaim/zaimPayments";
import { getZaimPlaces } from "../../services/zaim/zaimPlaces";
import type { HonoApp } from "../../workers";

export type ZaimRouteType = typeof zaimRoute;

export const zaimRoute = new Hono<HonoApp>()
	.post(
		"/login",
		vValidator(
			"query",
			v.object({
				"return-to": v.optional(v.string()),
			}),
		),
		async (c) => {
			// ZaimのログインURLを取得するエンドポイント
			const userId = getUserId(c);
			const { userAuthorizeUrl } = await getZaimLoginUrl({
				env: c.env,
				userId,
				returnTo: c.req.valid("query")["return-to"],
			});
			return c.json({ userAuthorizeUrl });
		},
	)
	.get(
		"/callback",
		vValidator(
			"query",
			v.object({
				oauth_token: v.string(),
				oauth_verifier: v.string(),
			}),
		),
		async (c) => {
			// ZaimのOAuthコールバックを処理するエンドポイント
			const { oauth_token, oauth_verifier } = c.req.valid("query");

			const userId = getUserId(c);

			const result = await handleZaimCallback({
				env: c.env,
				oauthToken: oauth_token,
				oauthVerifier: oauth_verifier,
				userId: userId,
			});

			if (isErr(result)) {
				logger.info({
					type: "zaim-callback-error",
					error: result.error,
				});
				return c.json(
					{
						code: result.error.code,
						message: "Failed to handle Zaim callback",
					},
					result.error.statusCode,
				);
			}

			if (result.value.returnTo !== undefined) {
				// リダイレクト先がある場合はリダイレクトする
				return c.redirect(result.value.returnTo, 302);
			}

			return c.json({
				message: "Zaim callback handled successfully",
				user: result.value.user,
			});
		},
	)
	.get("/categories", async (c) => {
		// カテゴリとジャンル（サブカテゴリ）を取得するエンドポイント

		// OIDCの認証情報を取得
		const userId = getUserId(c);

		const clientResult = await getUserZaimClient(c.env, userId);
		if (isErr(clientResult)) {
			return c.json(
				{
					code: clientResult.error.code,
					message: "Failed to access Zaim API",
				},
				500,
			);
		}

		const client = clientResult.value;

		return match(
			await getZaimCategories({
				client,
			}),
			(result) => {
				return c.json(
					{
						categories: result,
					},
					200,
				);
			},
			(error) => {
				logger.info({
					type: "zaim-categories-error",
					error,
				});
				return c.json(
					{
						code: "ZAIM_API_ERROR",
						message: "Failed to get Zaim categories",
					},
					500,
				);
			},
		);
	})
	.get("/payment-methods", async (c) => {
		// 支払い方法（アカウント）を取得するエンドポイント

		const userId = getUserId(c);
		const clientResult = await getUserZaimClient(c.env, userId);
		if (isErr(clientResult)) {
			logger.info({
				type: "zaim-client-error",
				error: clientResult.error,
			});
			return c.json(
				{
					code: clientResult.error.code,
					message: "Failed to access Zaim API",
				},
				500,
			);
		}

		const client = clientResult.value;

		return match(
			await getZaimPayments({
				client,
			}),
			(result) => {
				return c.json(
					{
						paymentMethods: result,
					},
					200,
				);
			},
			(error) => {
				logger.info({
					type: "zaim-payment-methods-error",
					error,
				});
				return c.json(
					{
						code: "ZAIM_API_ERROR",
						message: "Failed to get Zaim payment methods",
					},
					500,
				);
			},
		);
	})
	.get("/places", async (c) => {
		// 店舗の一覧を取得するエンドポイント
		const userId = getUserId(c);
		const clientResult = await getUserZaimClient(c.env, userId);
		if (isErr(clientResult)) {
			logger.info({
				type: "zaim-client-error",
				error: clientResult.error,
			});
			return c.json(
				{
					code: clientResult.error.code,
					message: "Failed to access Zaim API",
				},
				500,
			);
		}

		const client = clientResult.value;

		return match(
			await getZaimPlaces({
				client,
			}),
			(result) => {
				return c.json(
					{
						places: result,
					},
					200,
				);
			},
			(error) => {
				logger.info({
					type: "zaim-places-error",
					error,
				});
				return c.json(
					{
						code: "ZAIM_API_ERROR",
						message: "Failed to get Zaim places",
					},
					500,
				);
			},
		);
	});
