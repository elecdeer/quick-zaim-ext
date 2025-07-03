import { R } from "@praha/byethrow";
import { paymentOperationsCreate } from "@repo/zaim-api";
import type { Client } from "@repo/zaim-api/client";
import type { ZaimServiceError } from "./types";

export type CreatePaymentResult = {
	id: number;
	requested: number;
};

// リクエスト用の型定義
export type CreateReceiptRequest = {
	date: string;
	items: {
		name: string;
		amount: number;
		categoryId: string;
		priceYen: number;
	}[];
	shopId: string | null;
	paymentMethodId: string;
};

/**
 * レシート情報をZaim APIに支払いとして登録する
 */
export const createPayment = async ({
	client,
	receipt,
}: {
	client: Client;
	receipt: CreateReceiptRequest;
}): Promise<R.Result<CreatePaymentResult, ZaimServiceError>> => {
	// receiptの各itemを個別の支払いとして登録
	const results: CreatePaymentResult[] = [];

	// サーバー側でreceiptIdを採番（unix秒）
	const receiptId = Math.floor(Date.now() / 1000);

	for (const item of receipt.items) {
		const paymentData = {
			mapping: 1 as const,
			category_id: Number.parseInt(item.categoryId.split("-")[0] || "0"), // メインカテゴリID
			genre_id: Number.parseInt(item.categoryId), // サブカテゴリID
			amount: item.priceYen,
			date: receipt.date,
			from_account_id: Number.parseInt(receipt.paymentMethodId),
			comment: `${item.name} x${item.amount}`,
			name: item.name,
			place_uid: receipt.shopId || undefined,
			receipt_id: receiptId, // サーバー側で採番したunix秒を使用
		};

		const response = await paymentOperationsCreate({
			client,
			query: paymentData,
		});

		if (response.error) {
			return R.fail({
				code: "ZAIM_API_ERROR" as const,
				statusCode: 500 as const,
				message: "Failed to create payment in Zaim API",
				cause: response.error,
			});
		}

		results.push({
			id: response.data.money.id,
			requested: response.data.requested,
		});
	}

	// 最初の結果を返す（複数アイテムの場合は改善が必要）
	return R.succeed(results[0]);
};
