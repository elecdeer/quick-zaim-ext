import { R } from "@praha/byethrow";
import * as logger from "../../logger";
import type { KVCacheRepository } from "./kvCache";
import type { CacheError } from "./types";

/**
 * SWR (Stale-While-Revalidate) パターンを実装した汎用キャッシュラッパー
 */
export const withCache = async <T, E>({
	cacheRepo,
	fetcher,
	userId,
	logType,
}: {
	/** キャッシュリポジトリ */
	cacheRepo: KVCacheRepository<T>;
	/** データ取得関数 */
	fetcher: () => R.ResultAsync<T, E>;
	/** ユーザーID */
	userId: string;
	/** ログタイプのプレフィックス */
	logType: string;
}): R.ResultAsync<T, E | CacheError> => {
	// キャッシュからデータを取得
	const cacheResult = await cacheRepo.get();

	if (R.isSuccess(cacheResult) && cacheResult.value) {
		const { data: cachedData, isStale } = cacheResult.value;

		// キャッシュが新しい場合はそのまま返す
		if (!isStale) {
			logger.info({
				type: `${logType}-cache-hit`,
				userId,
				isStale: false,
			});

			return R.succeed(cachedData) as R.Success<T>;
		}

		// staleな場合はバックグラウンドで更新
		logger.info({
			type: `${logType}-cache-stale`,
			userId,
			isStale: true,
		});

		// バックグラウンドでAPI呼び出し（非同期）
		backgroundUpdate({
			fetcher,
			cacheRepo,
			userId,
			logType,
		}).catch((error) => {
			logger.error({
				type: `${logType}-background-update-error`,
				userId,
				error: error instanceof Error ? error.message : String(error),
			});
		});

		// staleなデータを返す
		return R.succeed(cachedData) as R.Success<T>;
	}

	// キャッシュがない場合はAPIを呼び出し
	logger.info({
		type: `${logType}-cache-miss`,
		userId,
	});

	const apiResult = await fetcher();
	if (R.isFailure(apiResult)) {
		throw apiResult.error;
	}

	// 新しいデータをキャッシュに保存
	const setCacheResult = await cacheRepo.set(apiResult.value);

	if (R.isFailure(setCacheResult)) {
		logger.warn({
			type: `${logType}-cache-write-failed`,
			userId,
			error: setCacheResult.error,
		});
		// キャッシュ保存失敗してもデータは返す
	}

	return R.succeed(apiResult.value) as R.Success<T>;
};

/**
 * バックグラウンドでAPI呼び出しとキャッシュ更新を行う
 */
async function backgroundUpdate<T, E>({
	fetcher,
	cacheRepo,
	userId,
	logType,
}: {
	fetcher: () => R.ResultAsync<T, E>;
	cacheRepo: {
		set: (data: T) => R.ResultAsync<void, CacheError>;
	};
	userId: string;
	logType: string;
}): Promise<void> {
	const apiResult = await fetcher();
	if (R.isFailure(apiResult)) {
		logger.error({
			type: `${logType}-background-fetch-error`,
			userId,
			error: apiResult.error,
		});
		return;
	}

	const setCacheResult = await cacheRepo.set(apiResult.value);

	if (R.isFailure(setCacheResult)) {
		logger.error({
			type: `${logType}-background-cache-error`,
			userId,
			error: setCacheResult.error,
		});
	} else {
		logger.info({
			type: `${logType}-background-update-success`,
			userId,
		});
	}
}
