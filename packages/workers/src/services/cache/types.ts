import type { ContentfulStatusCode } from "hono/utils/http-status";
import * as v from "valibot";

// キャッシュ対象のデータ型
export type CacheDataType = "categories" | "payment-methods" | "places";

// KVメタデータのスキーマ
export const cacheMetadataSchema = v.object({
	cachedAt: v.pipe(v.string(), v.isoTimestamp()),
	staleAt: v.pipe(v.string(), v.isoTimestamp()),
	dataType: v.picklist(["categories", "payment-methods", "places"]),
	userId: v.string(),
});

export type CacheMetadata = v.InferOutput<typeof cacheMetadataSchema>;

// Zaimカテゴリキャッシュのスキーマ
export const zaimCategoriesCacheSchema = v.object({
	data: v.array(
		v.object({
			id: v.number(),
			name: v.string(),
			subCategories: v.array(
				v.object({
					id: v.number(),
					name: v.string(),
				}),
			),
		}),
	),
	version: v.number(),
});

export type ZaimCategoriesCache = v.InferOutput<
	typeof zaimCategoriesCacheSchema
>;

// キャッシュ設定
export const cacheConfig = {
	categories: {
		ttlSeconds: 86400, // 24時間
		staleSeconds: 3600, // 1時間
		version: 1,
	},
	"payment-methods": {
		ttlSeconds: 3600, // 1時間
		staleSeconds: 600, // 10分
		version: 1,
	},
	places: {
		ttlSeconds: 1800, // 30分
		staleSeconds: 300, // 5分
		version: 1,
	},
} as const;

// キャッシュエラー
export type CacheError = {
	code: "CACHE_READ_ERROR" | "CACHE_WRITE_ERROR" | "CACHE_PARSE_ERROR";
	statusCode: ContentfulStatusCode;
	message: string;
	cause: unknown;
};

// キャッシュ結果
export type CacheResult<T> = {
	data: T;
	isStale: boolean;
	metadata: CacheMetadata;
};
