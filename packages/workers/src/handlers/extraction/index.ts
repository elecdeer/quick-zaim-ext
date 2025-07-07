import { vValidator } from "@hono/valibot-validator";
import { R } from "@praha/byethrow";
import { Hono } from "hono";
import * as v from "valibot";
import { getUserId } from "../../auth";
import * as logger from "../../logger";
import { extractFromAriaSnapshot } from "../../services/agent/extraction/extractFromA11yTree";
import { getLanguageModel } from "../../services/agent/model";
import { getUserZaimClient } from "../../services/zaim/zaimAuth";
import { getZaimCategories } from "../../services/zaim/zaimCategories";
import { getZaimPayments } from "../../services/zaim/zaimPayments";
import { getZaimPlaces } from "../../services/zaim/zaimPlaces";
import type { HonoApp } from "../../workers";

export type ExtractionRouteType = typeof extractionRoute;

export const extractionRoute = new Hono<HonoApp>().post(
	"/",
	vValidator(
		"json",
		v.object({
			ariaSnapshot: v.string(),
		}),
	),
	async (c) => {
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

		using _ = logger.metadata({
			userId,
		});

		const categories = await getZaimCategories({
			client: clientResult.value,
			env: c.env,
			userId,
		});
		if (R.isFailure(categories)) {
			logger.info({
				type: "zaim-service-error",
				error: categories.error,
			});
			return c.json(
				{
					code: categories.error.code,
					message: "Failed to get Zaim categories",
				},
				500,
			);
		}

		const paymentMethods = await getZaimPayments({
			client: clientResult.value,
		});
		if (R.isFailure(paymentMethods)) {
			logger.info({
				type: "zaim-service-error",
				error: paymentMethods.error,
			});
			return c.json(
				{
					code: paymentMethods.error.code,
					message: "Failed to get Zaim payment methods",
				},
				500,
			);
		}

		const places = await getZaimPlaces({
			client: clientResult.value,
		});
		if (R.isFailure(places)) {
			logger.info({
				type: "zaim-service-error",
				error: places.error,
			});
			return c.json(
				{
					code: places.error.code,
					message: "Failed to get Zaim places",
				},
				500,
			);
		}

		const { ariaSnapshot } = c.req.valid("json");

		const model = await getLanguageModel(c.env);

		const res = await extractFromAriaSnapshot(
			{
				ariaSnapshot,
				shops: places.value.map((place) => ({
					id: place.uid,
					name: place.name,
				})),
				categories: categories.value.map((category) => ({
					id: String(category.id),
					name: category.name,
					description: undefined,
					subCategories: category.subCategories.map((subCategory) => ({
						id: String(subCategory.id),
						name: subCategory.name,
						description: undefined,
					})),
				})),
				paymentMethods: paymentMethods.value.map((paymentMethod) => ({
					id: String(paymentMethod.id),
					name: paymentMethod.name,
					description: undefined,
				})),
			},
			model,
		);

		console.log(res);
		return c.json(res, 200);
	},
);
