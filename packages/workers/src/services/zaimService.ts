import {
	createOAuthSigner,
	fetchAccessToken,
	fetchRequestToken,
} from "@repo/oauth";
import type { RequestTokenPair } from "@repo/oauth";
import {
	type AccountAccount,
	type CategoryCategory,
	type GenreGenre,
	accountGetAccounts,
	categoryGetCategories,
	genreGetGenres,
	userVerifyUser,
} from "@repo/zaim-api";
import type { UserVerifyUserResponse } from "@repo/zaim-api";
import { client } from "@repo/zaim-api/client";
import type { Env } from "../env";

import * as logger from "../logger";

// 整形後のデータ型を定義
type ZaimCategory = {
	id: string;
	name: string;
	subCategories: { id: string; name: string }[];
};
type ZaimPaymentMethod = {
	id: string;
	name: string;
};

const zaimOAuthEndpoints = {
	accessTokenEndpoint: {
		url: "https://api.zaim.net/v2/auth/access",
		method: "GET",
	},
	requestTokenEndpoint: {
		url: "https://api.zaim.net/v2/auth/request",
		method: "GET",
	},
	authorizeEndpoint: {
		url: "https://auth.zaim.net/users/auth",
	},
} as const;

// Zaim API クライアント設定 (共通化)
const configureZaimClient = ({
	accessToken,
	accessTokenSecret,
	consumerKey,
	consumerSecret,
}: {
	accessToken: string;
	accessTokenSecret: string;
	consumerKey: string;
	consumerSecret: string;
}) => {
	const signer = createOAuthSigner({
		accessToken,
		accessTokenSecret,
		consumerKey,
		consumerSecret,
	});

	client.setConfig({
		baseUrl: "https://api.zaim.net/",
	});

	client.interceptors.request.use((req) => {
		logger.info({
			type: "zaim-api-request",
			method: req.method,
			url: req.url,
		});

		return signer(req);
	});

	client.interceptors.response.use(async (res) => {
		void res
			.clone()
			.json()
			.then((data) => {
				logger.info({
					type: "zaim-api-response",
					url: res.url,
					status: res.status,
					statusText: res.statusText,
					body: data,
				});
			})
			.catch((e) => {
				logger.error({
					message: "Failed to parse Zaim API response",
					error: e,
				});
			});

		return res;
	});
};

// --- Helper Functions (Internal) ---
/**
 * OIDC Sub に紐づくアクセストークンを取得し、認証済み Zaim クライアントを設定する
 * @throws Error - アクセストークンが見つからない場合
 */
const _getAuthenticatedZaimClient = async (
	env: Env, // Binding を含む Env 型を受け取る
	oidcSub: string,
): Promise<void> => {
	const kvKey = `${oidcSub}:zaim:oauth`;
	const tokenString = await env.ZAIM_AGENT_ZAIM_TOKENS_KV.get(kvKey);

	if (!tokenString) {
		throw new Error("Zaim access token not found for this user");
	}

	const token: {
		accessToken: string;
		accessTokenSecret: string;
		updatedAt: string;
	} = JSON.parse(tokenString);
	configureZaimClient({
		accessToken: token.accessToken,
		accessTokenSecret: token.accessTokenSecret,
		consumerKey: env.ZAIM_CONSUMER_KEY,
		consumerSecret: env.ZAIM_CONSUMER_SECRET,
	});
};

// --- Service Functions ---

/**
 * Zaimログイン用の認証URLを取得する
 */
export const getZaimLoginUrl = async (
	env: Env,
): Promise<{ userAuthorizeUrl: string }> => {
	const requestToken = await fetchRequestToken({
		requestTokenEndpoint: zaimOAuthEndpoints.requestTokenEndpoint,
		consumerKey: env.ZAIM_CONSUMER_KEY,
		consumerSecret: env.ZAIM_CONSUMER_SECRET,
		callbackUrl: env.ZAIM_CALLBACK_URL,
	});

	const userAuthorizeUrl = `${zaimOAuthEndpoints.authorizeEndpoint.url}?oauth_token=${requestToken.oauthToken}`;

	// requestTokenをKVに保存 (TTL: 10分 = 600秒)
	const kvKey = `req:${requestToken.oauthToken}`;
	const kvValue = JSON.stringify({
		oauthTokenSecret: requestToken.oauthTokenSecret,
	});

	try {
		await env.ZAIM_AGENT_ZAIM_TOKENS_KV.put(kvKey, kvValue, {
			expirationTtl: 600,
		});
		console.log(`Saved request token to KV: ${kvKey}`);
	} catch (e) {
		console.error("Failed to save request token to KV:", e);
		throw new Error("Failed to save request token");
	}

	return { userAuthorizeUrl };
};

/**
 * Zaim OAuthコールバックを処理する
 */
export const handleZaimCallback = async (
	env: Env,
	oauthToken: string,
	oauthVerifier: string,
	oidcSub: string | undefined,
): Promise<{ user: UserVerifyUserResponse["me"] }> => {
	// requestTokenをKVから取得
	const kvKeyRequest = `req:${oauthToken}`;
	const requestTokenString =
		await env.ZAIM_AGENT_ZAIM_TOKENS_KV.get(kvKeyRequest);
	let requestTokenPair: RequestTokenPair | null = null;

	if (requestTokenString) {
		try {
			const parsedToken: { oauthTokenSecret: string } =
				JSON.parse(requestTokenString);
			requestTokenPair = {
				oauthToken,
				oauthTokenSecret: parsedToken.oauthTokenSecret,
			};
		} catch (e) {
			console.error("Failed to parse request token from KV:", e);
			// パース失敗時は null のまま進み、後のチェックでエラーになる
		}
	}

	if (!requestTokenPair) {
		// エラーハンドリング: より具体的なエラーを投げるか、null等を返す
		throw new Error("Request token not found");
	}

	const accessTokenPair = await fetchAccessToken({
		accessTokenEndpoint: zaimOAuthEndpoints.accessTokenEndpoint,
		consumerKey: env.ZAIM_CONSUMER_KEY,
		consumerSecret: env.ZAIM_CONSUMER_SECRET,
		oauthVerifier: oauthVerifier,
		requestToken: requestTokenPair, // KVから取得したペアを使用
	});
	console.log("Obtained Access Token Pair:", accessTokenPair); // デバッグ用

	// 使用済みのrequestTokenをKVから削除
	try {
		await env.ZAIM_AGENT_ZAIM_TOKENS_KV.delete(kvKeyRequest); // Binding名を変更
		console.log(`Deleted request token from KV: ${kvKeyRequest}`);
	} catch (e) {
		// 削除エラーはログに残すが、処理は続行する（リトライ等で重複取得した場合など）
		console.error("Failed to delete request token from KV:", e);
	}

	// Zaim APIクライアントを設定
	configureZaimClient({
		accessToken: accessTokenPair.accessToken,
		accessTokenSecret: accessTokenPair.accessTokenSecret,
		consumerKey: env.ZAIM_CONSUMER_KEY,
		consumerSecret: env.ZAIM_CONSUMER_SECRET,
	});

	// ユーザー情報を検証
	const userResponse = await userVerifyUser();
	if (!userResponse || !userResponse.data || !userResponse.data.me) {
		// エラーハンドリング
		throw new Error("Failed to verify Zaim user");
	}
	const user = userResponse.data.me; // ユーザー情報を取得

	// OIDCのsubがあればアクセストークンをKVに保存
	if (oidcSub) {
		const kvKey = `${oidcSub}:zaim:oauth`;
		const kvValue = JSON.stringify({
			accessToken: accessTokenPair.accessToken,
			accessTokenSecret: accessTokenPair.accessTokenSecret,
			updatedAt: new Date().toISOString(), // 更新日時を追加
		});
		try {
			await env.ZAIM_AGENT_ZAIM_TOKENS_KV.put(kvKey, kvValue); // Binding名を変更
			console.log(`Saved access token to KV for user: ${oidcSub}`);
		} catch (e) {
			console.error("Failed to save access token to KV:", e);
			// エラーを再スローするか、ハンドリングするか検討
			throw new Error("Failed to save Zaim access token");
		}
	} else {
		console.log("No OIDC sub provided, skipping access token save.");
	}

	// userVerifyUser の戻り値全体を返すか、必要な情報だけ返すか検討
	return { user };
};

/**
 * OIDC Subに紐づくZaimアクセストークンの存在を確認する
 */
export const checkZaimTokenExists = async (
	env: Env,
	oidcSub: string,
): Promise<boolean> => {
	// parseEnv は不要 (Bindingのみ使用)
	const kvKey = `${oidcSub}:zaim:oauth`;
	// KVから値を取得
	const tokenString = await env.ZAIM_AGENT_ZAIM_TOKENS_KV.get(kvKey); // Binding名を変更
	// 値が存在すれば true, しなければ false を返す
	return tokenString !== null;
};

/**
 * Zaimからカテゴリとジャンルを取得・整形する
 */
export const getZaimCategories = async (
	env: Env,
	oidcSub: string,
): Promise<ZaimCategory[]> => {
	await _getAuthenticatedZaimClient(env, oidcSub);

	try {
		// カテゴリとジャンル（サブカテゴリ）を取得
		const categoriesResponse = await categoryGetCategories({
			query: { mapping: 1 },
			throwOnError: true,
		});
		const genresResponse = await genreGetGenres({
			query: { mapping: 1 },
			throwOnError: true,
		});

		if (!categoriesResponse.data?.categories || !genresResponse.data?.genres) {
			throw new Error("Failed to retrieve categories or genres from Zaim API");
		}

		// カテゴリとサブカテゴリを整形
		const categories = categoriesResponse.data.categories.map(
			(category: CategoryCategory) => {
				// このカテゴリに属するジャンル（サブカテゴリ）を取得
				const subCategories = genresResponse.data.genres
					.filter((genre: GenreGenre) => genre.category_id === category.id)
					.map((genre: GenreGenre) => ({
						id: String(genre.id),
						name: genre.name,
						// description: undefined, // 不要なら削除
					}));

				return {
					id: String(category.id),
					name: category.name,
					// description: undefined, // 不要なら削除
					subCategories,
				};
			},
		);

		return categories;
	} catch (error) {
		console.error("Zaim API error in getZaimCategories:", error);
		// API呼び出しエラーを再スローするか、カスタムエラーを投げる
		throw new Error("Failed to call Zaim API for categories/genres");
	}
};

/**
 * Zaimから支払い方法（アカウント）を取得・整形する
 */
export const getZaimPaymentMethods = async (
	env: Env, // Binding を含む Env 型を受け取る
	oidcSub: string,
): Promise<ZaimPaymentMethod[]> => {
	// const env = parseEnv(env); // _getAuthenticatedZaimClient内でパースされる
	// paymentMethodsの型は要検討 (例: { id: string; name: string }[])
	await _getAuthenticatedZaimClient(env, oidcSub);

	try {
		// アカウント（支払い方法）を取得
		const accountsResponse = await accountGetAccounts({
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
				// description: undefined, // 不要なら削除
			}),
		);

		return paymentMethods;
	} catch (error) {
		console.error("Zaim API error in getZaimPaymentMethods:", error);
		// API呼び出しエラーを再スローするか、カスタムエラーを投げる
		throw new Error("Failed to call Zaim API for accounts");
	}
};

/**
 * カテゴリ、ジャンル、支払い方法をまとめて取得する (getZaimData相当)
 * 必要に応じて分割・リファクタリングする
 */
export const getZaimMasterData = async (
	env: Env,
	oidcSub: string,
): Promise<{
	categories: ZaimCategory[];
	paymentMethods: ZaimPaymentMethod[];
}> => {
	// カテゴリと支払い方法を並行して取得 (効率化)
	try {
		const [categories, paymentMethods] = await Promise.all([
			getZaimCategories(env, oidcSub),
			getZaimPaymentMethods(env, oidcSub),
		]);

		return { categories, paymentMethods };
	} catch (error) {
		// エラーハンドリング: getZaimCategories や getZaimPaymentMethods 内で発生したエラーをキャッチ
		console.error("Error fetching Zaim master data:", error);
		// エラーを再スローするか、ハンドラー側で処理しやすい形にラップする
		if (
			error instanceof Error &&
			error.message.includes("Zaim access token not found")
		) {
			throw new Error("Zaim access token not found for this user");
		}
		throw new Error("Failed to fetch Zaim master data");
	}
};
