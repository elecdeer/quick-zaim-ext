import { R } from "@praha/byethrow";
import * as v from "valibot";
import type { Env } from "../../env";
import * as logger from "../../logger";
import type {
	CacheDataType,
	CacheError,
	CacheMetadata,
	CacheResult,
} from "./types";
import { cacheConfig, cacheMetadataSchema } from "./types";

/**
 * キャッシュキーを生成
 */
const generateCacheKey = (userId: string, dataType: CacheDataType): string => {
	return `zaim-cache:${userId}:${dataType}`;
};

/**
 * キャッシュからデータを取得
 */
const getCacheData = async <T>(
	env: Env,
	userId: string,
	dataType: CacheDataType,
	schema: v.BaseSchema<unknown, T, v.BaseIssue<unknown>>,
): Promise<R.Result<CacheResult<T> | null, CacheError>> => {
	try {
		const cacheKey = generateCacheKey(userId, dataType);
		const result = await env.ZAIM_AGENT_CACHE_KV.getWithMetadata(cacheKey, {
			type: "json",
		});

		if (!result.value || !result.metadata) {
			return R.succeed(null);
		}

		// メタデータの検証
		const metadataResult = v.safeParse(cacheMetadataSchema, result.metadata);
		if (!metadataResult.success) {
			logger.warn({
				type: "cache-metadata-parse-error",
				dataType,
				userId,
				error: metadataResult.issues,
			});
			return R.succeed(null);
		}

		// データの検証
		const dataResult = v.safeParse(schema, result.value);
		if (!dataResult.success) {
			logger.warn({
				type: "cache-data-parse-error",
				dataType,
				userId,
				error: dataResult.issues,
			});
			return R.succeed(null);
		}

		const now = new Date();
		const staleAt = new Date(metadataResult.output.staleAt);
		const isStale = now > staleAt;

		return R.succeed({
			data: dataResult.output,
			isStale,
			metadata: metadataResult.output,
		});
	} catch (error) {
		logger.error({
			type: "cache-read-error",
			dataType,
			userId,
			error: error instanceof Error ? error.message : String(error),
		});

		return R.fail({
			code: "CACHE_READ_ERROR",
			statusCode: 500,
			message: "Failed to read from cache",
			cause: error,
		});
	}
};

/**
 * キャッシュにデータを保存
 */
const setCacheData = async <T>(
	env: Env,
	userId: string,
	dataType: CacheDataType,
	data: T,
	schema: v.BaseSchema<unknown, T, v.BaseIssue<unknown>>,
): Promise<R.Result<void, CacheError>> => {
	try {
		const config = cacheConfig[dataType];
		const now = new Date();
		const staleAt = new Date(now.getTime() + config.staleSeconds * 1000);

		// データの検証
		const dataResult = v.safeParse(schema, data);
		if (!dataResult.success) {
			return R.fail({
				code: "CACHE_WRITE_ERROR",
				statusCode: 500,
				message: "Invalid data format for cache",
				cause: dataResult.issues,
			});
		}

		const metadata: CacheMetadata = {
			cachedAt: now.toISOString(),
			staleAt: staleAt.toISOString(),
			dataType,
			userId,
		};

		const cacheKey = generateCacheKey(userId, dataType);
		await env.ZAIM_AGENT_CACHE_KV.put(
			cacheKey,
			JSON.stringify(dataResult.output),
			{
				expirationTtl: config.ttlSeconds,
				metadata,
			},
		);

		logger.info({
			type: "cache-write-success",
			dataType,
			userId,
			ttl: config.ttlSeconds,
			staleSeconds: config.staleSeconds,
		});

		return R.succeed(undefined);
	} catch (error) {
		logger.error({
			type: "cache-write-error",
			dataType,
			userId,
			error: error instanceof Error ? error.message : String(error),
		});

		return R.fail({
			code: "CACHE_WRITE_ERROR",
			statusCode: 500,
			message: "Failed to write to cache",
			cause: error,
		});
	}
};

/**
 * キャッシュからデータを削除
 */
const deleteCacheData = async (
	env: Env,
	userId: string,
	dataType: CacheDataType,
): Promise<void> => {
	try {
		const cacheKey = generateCacheKey(userId, dataType);
		await env.ZAIM_AGENT_CACHE_KV.delete(cacheKey);

		logger.info({
			type: "cache-delete-success",
			dataType,
			userId,
		});
	} catch (error) {
		logger.error({
			type: "cache-delete-error",
			dataType,
			userId,
			error: error instanceof Error ? error.message : String(error),
		});
	}
};

export type KVCacheRepository<T> = {
	get: () => Promise<R.Result<CacheResult<T> | null, CacheError>>;
	set: (data: T) => Promise<R.Result<void, CacheError>>;
	delete: () => Promise<void>;
};

/**
 * 特定のデータ型とスキーマに特化したKVキャッシュリポジトリを取得
 */
export const getKVCacheRepository = <T>(
	env: Env,
	userId: string,
	dataType: CacheDataType,
	schema: v.BaseSchema<unknown, T, v.BaseIssue<unknown>>,
): KVCacheRepository<T> => {
	return {
		get: () => getCacheData(env, userId, dataType, schema),
		set: (data: T) => setCacheData(env, userId, dataType, data, schema),
		delete: () => deleteCacheData(env, userId, dataType),
	};
};
