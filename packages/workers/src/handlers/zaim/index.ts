import { vValidator } from "@hono/valibot-validator";
import { R } from "@praha/byethrow";
import { Hono } from "hono";
import * as v from "valibot";
import { getUserId } from "../../auth";
import * as logger from "../../logger";

// リクエスト専用のスキーマを定義（LLM抽出用のreceiptSchemaとは別）

import {
	getUserZaimClient,
	getZaimLoginUrl,
	handleZaimCallback,
} from "../../services/zaim/zaimAuth";
import { getZaimCategories } from "../../services/zaim/zaimCategories";
import { createPayment } from "../../services/zaim/zaimMoney";
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

			if (R.isFailure(result)) {
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
		if (R.isFailure(clientResult)) {
			return c.json(
				{
					code: R.unwrapError(clientResult).code,
					message: "Failed to access Zaim API",
				},
				500,
			);
		}

		clientResult.value;

		const client = clientResult.value;

		const categories = await getZaimCategories({
			client,
			env: c.env,
			userId,
			waitUntil: c.executionCtx.waitUntil,
		});
		if (R.isFailure(categories)) {
			logger.info({
				type: "zaim-categories-error",
				error: categories.error,
			});
			return c.json(
				{
					code: "ZAIM_API_ERROR",
					message: "Failed to get Zaim categories",
				},
				500,
			);
		}
		return c.json(
			{
				categories: categories.value,
			},
			200,
		);
	})
	.get("/payment-methods", async (c) => {
		// 支払い方法（アカウント）を取得するエンドポイント

		const userId = getUserId(c);
		const clientResult = await getUserZaimClient(c.env, userId);
		if (R.isFailure(clientResult)) {
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

		const paymentMethods = await getZaimPayments({
			client,
		});
		if (R.isFailure(paymentMethods)) {
			logger.info({
				type: "zaim-payment-methods-error",
				error: paymentMethods.error,
			});
			return c.json(
				{
					code: "ZAIM_API_ERROR",
					message: "Failed to get Zaim payment methods",
				},
				500,
			);
		}
		return c.json(
			{
				paymentMethods: paymentMethods.value,
			},
			200,
		);
	})
	.get("/places", async (c) => {
		// 店舗の一覧を取得するエンドポイント
		const userId = getUserId(c);
		const clientResult = await getUserZaimClient(c.env, userId);
		if (R.isFailure(clientResult)) {
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

		const places = await getZaimPlaces({
			client,
		});

		if (R.isFailure(places)) {
			logger.info({
				type: "zaim-places-error",
				error: places.error,
			});
			return c.json(
				{
					code: "ZAIM_API_ERROR",
					message: "Failed to get Zaim places",
				},
				500,
			);
		}
		return c.json(
			{
				places: places.value,
			},
			200,
		);
	})
	.post(
		"/receipt",
		vValidator(
			"json",
			v.object({
				date: v.string(),
				items: v.array(
					v.object({
						name: v.string(),
						amount: v.pipe(v.number(), v.integer()),
						categoryId: v.string(),
						priceYen: v.number(),
					}),
				),
				shopId: v.nullable(v.string()),
				paymentMethodId: v.string(),
				orderNo: v.string(), // 注文番号（memoフィールドに記録用）
			}),
		),
		async (c) => {
			// レシート情報をZaim APIに登録するエンドポイント
			const userId = getUserId(c);
			const receipt = c.req.valid("json");

			const clientResult = await getUserZaimClient(c.env, userId);
			if (R.isFailure(clientResult)) {
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

			const result = await createPayment({
				client,
				receipt,
			});

			if (R.isFailure(result)) {
				logger.info({
					type: "zaim-create-payment-error",
					error: result.error,
				});
				return c.json(
					{
						code: result.error.code,
						message: "Failed to create payment in Zaim",
					},
					500,
				);
			}

			return c.json(
				{
					success: true,
					payment: result.value,
				},
				200,
			);
		},
	);
