import { R } from "@praha/byethrow";
import { accountGetAccounts } from "@repo/zaim-api";
import type { Client } from "@repo/zaim-api/client";
import type { ZaimPaymentMethod, ZaimServiceError } from "./types";

/**
 * Zaim APIから登録されている支払い方法の一覧を取得する
 */
export const getZaimPayments = async ({
	client,
}: {
	client: Client;
}): Promise<R.Result<ZaimPaymentMethod[], ZaimServiceError>> => {
	const res = await accountGetAccounts({
		client,
		query: { mapping: 1 },
	});

	if (res.error) {
		return R.fail({
			code: "ZAIM_API_ERROR" as const,
			statusCode: 500 as const,
			message: "Failed to retrieve payments from Zaim API.",
			cause: res.error,
		});
	}

	return R.succeed(
		res.data.accounts.map((account) => ({
			id: account.id,
			name: account.name,
		})),
	);
};
