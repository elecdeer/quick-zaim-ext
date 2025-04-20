import type { ContentfulStatusCode } from "hono/utils/http-status";

// 整形後のデータ型を定義
export type ZaimCategory = {
	id: number;
	name: string;
	subCategories: {
		id: number;
		name: string;
	}[];
};
export type ZaimPaymentMethod = {
	id: number;
	name: string;
};

export type ZaimServiceError = {
	code:
		| "INVALID_REQUEST"
		| "INTERNAL_ERROR"
		| "ZAIM_API_ERROR"
		| "ZAIM_AUTH_ERROR";
	statusCode: ContentfulStatusCode;
	message: string;
	cause: unknown;
};
