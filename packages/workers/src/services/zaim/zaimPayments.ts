import type { Client } from "@hey-api/client-fetch";
import { accountGetAccounts } from "@repo/zaim-api";
import { type Result, err, ok } from "../../result";
import type { ZaimPaymentMethod, ZaimServiceError } from "./types";

/**
 * Zaim APIから登録されている支払い方法の一覧を取得する
 */
export const getZaimPayments = async ({
	client,
}: {
	client: Client;
}): Promise<Result<ZaimPaymentMethod[], ZaimServiceError>> => {
	const res = await accountGetAccounts({
		client,
		query: { mapping: 1 },
	});

	if (res.error) {
		return err({
			code: "ZAIM_API_ERROR",
			statusCode: 500,
			message: "Failed to retrieve payments from Zaim API.",
			cause: res.error,
		});
	}

	return ok(
		res.data.accounts.map((account) => ({
			id: account.id,
			name: account.name,
		})),
	);
};
