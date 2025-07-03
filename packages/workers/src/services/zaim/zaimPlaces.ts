import { R } from "@praha/byethrow";
import { type MoneyMoney, moneyGetMoney } from "@repo/zaim-api";
import type { Client } from "@repo/zaim-api/client";
import type { ZaimPlace, ZaimServiceError } from "./types";

/**
 * Zaim APIから登録されている店舗の一覧を取得する
 */
export const getZaimPlaces = async ({
	client,
}: {
	client: Client;
}): Promise<R.Result<ZaimPlace[], ZaimServiceError>> => {
	const res = await moneyGetMoney({
		client,
		query: { mapping: 1, mode: "payment", group_by: "receipt_id" },
	});

	if (res.error) {
		return R.fail({
			code: "ZAIM_API_ERROR" as const,
			statusCode: 500 as const,
			message: "Failed to retrieve places from Zaim API.",
			cause: res.error,
		});
	}

	const places = Object.entries(
		Object.groupBy(res.data.money, (money) => money.place_uid) as Required<
			Record<string, MoneyMoney[]>
		>,
	).flatMap(([uid, moneys]) => {
		if (uid === "") {
			return [];
		}

		return [
			{
				uid,
				name: moneys[0].place,
				count: moneys.length,
				recommend: {
					categoryId: countBy(moneys, (money) => money.category_id),
					subCategoryId: countBy(moneys, (money) => money.genre_id),
					paymentMethodId: countBy(moneys, (money) => money.from_account_id),
				},
			} satisfies ZaimPlace,
		];
	});

	return R.succeed(places);
};

const countBy = <T, U extends PropertyKey>(
	collection: T[],
	predicate: (item: T) => U,
): {
	id: U;
	count: number;
}[] => {
	const map = new Map<U, number>();

	for (const item of collection) {
		const key = predicate(item);
		map.set(key, (map.get(key) ?? 0) + 1);
	}

	return [...map.entries()].map(([id, count]) => ({
		id,
		count,
	}));
};
