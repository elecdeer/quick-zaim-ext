import { type AccountAccount, accountGetAccounts } from "@repo/zaim-api";
import type { Env } from "../../env"; // Adjusted path
import * as logger from "../../logger"; // Adjusted path
import type { ZaimPaymentMethod } from "./types"; // Import the specific type
import { configureZaimClient } from "./zaimAuth"; // Import client config function

/**
 * Zaimから支払い方法（アカウント）を取得・整形する
 */
export const getZaimPaymentMethods = async ({
	env,
	oidcSub, // Keep oidcSub if needed for logging or other purposes, otherwise remove
	accessToken,
	accessTokenSecret,
}: {
	env: Env;
	oidcSub: string; // Or remove if not needed
	accessToken: string;
	accessTokenSecret: string;
}): Promise<ZaimPaymentMethod[]> => {
	// Configure the client using the provided tokens
	const client = configureZaimClient({
		accessToken,
		accessTokenSecret,
		consumerKey: env.ZAIM_CONSUMER_KEY,
		consumerSecret: env.ZAIM_CONSUMER_SECRET,
	});

	try {
		// アカウント（支払い方法）を取得 (pass client instance)
		const accountsResponse = await accountGetAccounts({
			client: client, // Pass the configured client
			query: { mapping: 1 },
			throwOnError: true,
		});

		if (!accountsResponse.data?.accounts) {
			throw new Error("Failed to retrieve accounts from Zaim API");
		}

		// 支払い方法を整形
		const paymentMethods = accountsResponse.data.accounts.map(
			(account: AccountAccount) => ({
				id: String(account.id),
				name: account.name,
			}),
		);

		return paymentMethods;
	} catch (error: unknown) {
		// Add type
		logger.error({
			// Use logger for errors
			message: "Zaim API error in getZaimPaymentMethods",
			oidcSub: oidcSub, // Log relevant info
			error: error instanceof Error ? error.message : String(error),
			stack: error instanceof Error ? error.stack : undefined,
		});
		// API呼び出しエラーを再スローするか、カスタムエラーを投げる
		throw new Error("Failed to call Zaim API for accounts");
	}
};
