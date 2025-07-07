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
}: {
	/** キャッシュリポジトリ */
	cacheRepo: KVCacheRepository<T>;
	/** データ取得関数 */
	fetcher: () => R.ResultAsync<T, E>;
}): R.ResultAsync<T, E | CacheError> => {
	// キャッシュからデータを取得
	const cacheResult = await cacheRepo.get();

	if (R.isSuccess(cacheResult) && cacheResult.value) {
		const { data: cachedData, isStale } = cacheResult.value;

		// キャッシュが新しい場合はそのまま返す
		if (!isStale) {
			logger.info({
				type: "cache-hit",
				isStale: false,
			});

			return R.succeed(cachedData) as R.Success<T>;
		}

		// staleな場合はバックグラウンドで更新
		logger.info({
			type: "cache-stale",
			isStale: true,
		});

		// バックグラウンドでAPI呼び出し（非同期）
		void backgroundUpdate({
			fetcher,
			cacheRepo,
		});

		// staleなデータを返す
		return R.succeed(cachedData) as R.Success<T>;
	}

	// キャッシュがない場合はAPIを呼び出し
	logger.info({
		type: "cache-miss",
	});

	const apiResult = await fetcher();
	if (R.isFailure(apiResult)) {
		logger.error({
			type: "api-fetch-error",
			error: apiResult.error,
		});
		// API呼び出し失敗時はキャッシュも更新しない
		return R.fail(apiResult.error) as R.Failure<E | CacheError>;
	}

	// 新しいデータをキャッシュに保存
	const setCacheResult = await cacheRepo.set(apiResult.value);

	if (R.isFailure(setCacheResult)) {
		logger.warn({
			type: "cache-write-failed",
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
}: {
	fetcher: () => R.ResultAsync<T, E>;
	cacheRepo: {
		set: (data: T) => R.ResultAsync<void, CacheError>;
	};
}): Promise<void> {
	const apiResult = await fetcher();
	if (R.isFailure(apiResult)) {
		logger.error({
			type: "background-fetch-error",
			error: apiResult.error,
		});
		return;
	}

	const setCacheResult = await cacheRepo.set(apiResult.value);

	if (R.isFailure(setCacheResult)) {
		logger.error({
			type: "background-cache-error",
			error: setCacheResult.error,
		});
	} else {
		logger.info({
			type: "background-update-success",
		});
	}
}
