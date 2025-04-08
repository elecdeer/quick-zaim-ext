import type { Env } from "../../env"; // Adjusted path
import * as logger from "../../logger"; // Adjusted path
import { getZaimCategories } from "./getZaimCategories"; // Import function
import { getZaimPaymentMethods } from "./getZaimPaymentMethods"; // Import function
import type { ZaimCategory, ZaimPaymentMethod } from "./types"; // Import types

/**
 * カテゴリ、支払い方法をまとめて取得する
 */
export const getZaimMasterData = async ({
	env,
	oidcSub,
	accessToken,
	accessTokenSecret,
}: {
	env: Env;
	oidcSub: string;
	accessToken: string;
	accessTokenSecret: string;
}): Promise<{
	categories: ZaimCategory[];
	paymentMethods: ZaimPaymentMethod[];
}> => {
	// カテゴリと支払い方法を並行して取得 (効率化)
	// Pass necessary arguments including tokens to the underlying functions
	const getCategoriesArgs = { env, oidcSub, accessToken, accessTokenSecret };
	const getPaymentMethodsArgs = {
		env,
		oidcSub,
		accessToken,
		accessTokenSecret,
	};

	try {
		const [categories, paymentMethods] = await Promise.all([
			getZaimCategories(getCategoriesArgs),
			getZaimPaymentMethods(getPaymentMethodsArgs),
		]);

		return { categories, paymentMethods };
	} catch (error: unknown) {
		// Add type
		// エラーハンドリング: getZaimCategories や getZaimPaymentMethods 内で発生したエラーをキャッチ
		logger.error({
			// Use logger for errors
			message: "Error fetching Zaim master data",
			oidcSub: oidcSub, // Log relevant info
			error: error instanceof Error ? error.message : String(error),
			stack: error instanceof Error ? error.stack : undefined,
		});
		// エラーを再スローするか、ハンドラー側で処理しやすい形にラップする
		// The specific "token not found" error should be handled by the caller
		// when calling getZaimAccessToken before this function.
		throw new Error("Failed to fetch Zaim master data");
	}
};
