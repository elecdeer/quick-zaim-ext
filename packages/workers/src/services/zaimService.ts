import {
  createOAuthSigner,
  fetchAccessToken,
  fetchRequestToken
} from "@repo/oauth";
import {
  accountGetAccounts,
  categoryGetCategories,
  genreGetGenres,
  userVerifyUser,
  type AccountAccount,
  type CategoryCategory,
  type GenreGenre,
} from "@repo/zaim-api";
import { client } from "@repo/zaim-api/client";
import { accessTokenRepository, requestTokenRepository, type createDb } from "../db";
import { type parseEnv } from "../env";
type DrizzleDB = ReturnType<typeof createDb>;
type ParsedEnv = ReturnType<typeof parseEnv>;

// Zaim OAuth エンドポイント (ハンドラーから移動)
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
const configureZaimClient = (
	accessToken: string,
	accessTokenSecret: string,
	env: ParsedEnv,
) => {
	const signer = createOAuthSigner({
		accessToken,
		accessTokenSecret,
		consumerKey: env.ZAIM_CONSUMER_KEY,
		consumerSecret: env.ZAIM_CONSUMER_SECRET,
	});

	client.setConfig({
		baseUrl: "https://api.zaim.net/",
	});
	// リクエストインターセプターをクリアしてから設定
	// client.interceptors.request.clear(); // clearメソッドは存在しない
	client.interceptors.request.use((req) => {
		console.log("Zaim API Request:", req.url);
		return signer(req);
	});
	// レスポンスインターセプターも必要に応じてクリア・設定
	// client.interceptors.response.clear(); // clearメソッドは存在しない
	client.interceptors.response.use((res) => {
		// console.log("Zaim API Response:", res.status);
		// res.clone().json().then(data => console.log("Zaim API Response Data:", data)).catch(e => console.error("Failed to parse Zaim API response", e));
		return res;
	});
};

// --- Helper Functions (Internal) ---
/**
 * OIDC Sub に紐づくアクセストークンを取得し、認証済み Zaim クライアントを設定する
 * @throws Error - アクセストークンが見つからない場合
 */
const _getAuthenticatedZaimClient = async (
	db: DrizzleDB,
	env: ParsedEnv,
	oidcSub: string,
): Promise<void> => { // 戻り値は void で良い (client の設定が副作用)
	const token = await accessTokenRepository.getAccessToken(db, oidcSub);
	if (!token) {
		throw new Error("Zaim access token not found for this user"); // より具体的なエラーメッセージ
	}

	configureZaimClient(token.accessToken, token.accessTokenSecret, env);
};

// --- Service Functions ---

/**
 * Zaimログイン用の認証URLを取得する
 */
export const getZaimLoginUrl = async (
	db: DrizzleDB,
	env: ParsedEnv,
): Promise<{ userAuthorizeUrl: string }> => {
	const requestToken = await fetchRequestToken({
		requestTokenEndpoint: zaimOAuthEndpoints.requestTokenEndpoint,
		consumerKey: env.ZAIM_CONSUMER_KEY,
		consumerSecret: env.ZAIM_CONSUMER_SECRET,
		callbackUrl: env.ZAIM_CALLBACK_URL,
	});

	const userAuthorizeUrl = `${zaimOAuthEndpoints.authorizeEndpoint.url}?oauth_token=${requestToken.oauthToken}`;

	// requestTokenを保存
	await requestTokenRepository.saveRequestToken(db, {
		oauthToken: requestToken.oauthToken,
		oauthTokenSecret: requestToken.oauthTokenSecret,
	});

	return { userAuthorizeUrl };
};

/**
 * Zaim OAuthコールバックを処理する
 */
export const handleZaimCallback = async (
	db: DrizzleDB,
	env: ParsedEnv,
	oauthToken: string,
	oauthVerifier: string,
	oidcSub: string | undefined,
): Promise<{ user: any }> => {
	// userの型は @repo/zaim-api の userVerifyUser の戻り値を確認する
	// requestTokenを取得
	const requestToken = await requestTokenRepository.getRequestToken(
		db,
		oauthToken,
	);

	if (!requestToken) {
		// エラーハンドリング: より具体的なエラーを投げるか、null等を返す
		throw new Error("Request token not found");
	}

	const accessTokenPair = await fetchAccessToken({
		accessTokenEndpoint: zaimOAuthEndpoints.accessTokenEndpoint,
		consumerKey: env.ZAIM_CONSUMER_KEY,
		consumerSecret: env.ZAIM_CONSUMER_SECRET,
		oauthVerifier: oauthVerifier,
		requestToken: requestToken, // 型が RequestTokenPair になっているか確認
	});
	console.log("Obtained Access Token Pair:", accessTokenPair); // デバッグ用

	// 使用済みのrequestTokenを削除
	await requestTokenRepository.deleteRequestToken(db, oauthToken);

	// Zaim APIクライアントを設定
	configureZaimClient(
		accessTokenPair.accessToken,
		accessTokenPair.accessTokenSecret,
		env,
	);

	// ユーザー情報を検証
	const userResponse = await userVerifyUser();
	if (!userResponse || !userResponse.data || !userResponse.data.me) {
		// エラーハンドリング
		throw new Error("Failed to verify Zaim user");
	}
	const user = userResponse.data.me; // ユーザー情報を取得

	// OIDCのsubがあればアクセストークンを保存
	if (oidcSub) {
		await accessTokenRepository.saveAccessToken(db, {
			sub: oidcSub,
			accessToken: accessTokenPair.accessToken,
			accessTokenSecret: accessTokenPair.accessTokenSecret,
		});
		console.log(`Saved access token for user: ${oidcSub}`);
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
	db: DrizzleDB,
	oidcSub: string,
): Promise<boolean> => {
	// アクセストークンを取得
	const token = await accessTokenRepository.getAccessToken(db, oidcSub);
	// トークンが存在すれば true, しなければ false を返す
	return !!token;
};

/**
 * Zaimからカテゴリとジャンルを取得・整形する
 */
export const getZaimCategories = async (
	db: DrizzleDB,
	env: ParsedEnv,
	oidcSub: string,
): Promise<any[]> => { // categoriesの型は要検討 (例: { id: string; name: string; subCategories: { id: string; name: string }[] }[])
	await _getAuthenticatedZaimClient(db, env, oidcSub);

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
	db: DrizzleDB,
	env: ParsedEnv,
	oidcSub: string,
): Promise<any[]> => { // paymentMethodsの型は要検討 (例: { id: string; name: string }[])
	await _getAuthenticatedZaimClient(db, env, oidcSub);

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
	db: DrizzleDB,
	env: ParsedEnv,
	oidcSub: string,
): Promise<{ categories: any[]; paymentMethods: any[] }> => {
	// アクセストークン取得とクライアント設定は各関数内で実施されるため、ここでは不要
	// await _getAuthenticatedZaimClient(db, env, oidcSub); // 不要

	// カテゴリと支払い方法を並行して取得 (効率化)
	try {
		const [categories, paymentMethods] = await Promise.all([
			getZaimCategories(db, env, oidcSub),
			getZaimPaymentMethods(db, env, oidcSub),
		]);

		return { categories, paymentMethods };
	} catch (error) {
		// エラーハンドリング: getZaimCategories や getZaimPaymentMethods 内で発生したエラーをキャッチ
		console.error("Error fetching Zaim master data:", error);
		// エラーを再スローするか、ハンドラー側で処理しやすい形にラップする
		if (error instanceof Error && error.message.includes("Zaim access token not found")) {
			throw new Error("Zaim access token not found for this user");
		}
		throw new Error("Failed to fetch Zaim master data");
	}
};
