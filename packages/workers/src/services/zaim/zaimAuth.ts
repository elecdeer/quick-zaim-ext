import { type Client, createClient } from "@hey-api/client-fetch";
import {
	createOAuthSigner,
	fetchAccessToken,
	fetchRequestToken,
} from "@repo/oauth";
import type { RequestTokenPair } from "@repo/oauth";
import { userVerifyUser } from "@repo/zaim-api";
import type { UserVerifyUserResponse } from "@repo/zaim-api";
import type { Env } from "../../env";
import * as logger from "../../logger";

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

// Zaim API クライアント設定 (インスタンスを返すように変更)
export const configureZaimClient = ({
	accessToken,
	accessTokenSecret,
	consumerKey,
	consumerSecret,
}: {
	accessToken: string;
	accessTokenSecret: string;
	consumerKey: string;
	consumerSecret: string;
}): Client => {
	const signer = createOAuthSigner({
		accessToken,
		accessTokenSecret,
		consumerKey,
		consumerSecret,
	});

	// Create a new client instance using createClient
	const client = createClient({
		baseUrl: "https://api.zaim.net/",
	});

	// Add interceptors to the new client instance
	client.interceptors.request.use((req: Request) => {
		// Add type Request
		logger.info({
			type: "zaim-api-request",
			method: req.method,
			url: req.url,
		});
		// Apply signer and return the modified request or a Promise<Request>
		return Promise.resolve(signer(req)); // Ensure it returns a Promise<Request> if signer is sync
	});

	client.interceptors.response.use(async (res: Response) => {
		// Add type Response
		// Clone the response for logging, as the body can only be read once
		const clonedRes = res.clone();
		try {
			const data: unknown = await clonedRes.json(); // Add type unknown
			logger.info({
				type: "zaim-api-response",
				url: res.url,
				status: res.status,
				statusText: res.statusText,
				body: data,
			});
		} catch (e: unknown) {
			// Add type unknown or Error
			logger.error({
				message: "Failed to parse Zaim API response as JSON",
				url: res.url,
				status: res.status,
				statusText: res.statusText,
				error: e instanceof Error ? e.message : String(e), // Log error message
			});
			// Attempt to log as text if JSON parsing fails
			try {
				const text = await clonedRes.text();
				logger.info({
					type: "zaim-api-response-text",
					url: res.url,
					status: res.status,
					statusText: res.statusText,
					body: text,
				});
			} catch (textError: unknown) {
				logger.error({
					message: "Failed to read Zaim API response as text",
					error:
						textError instanceof Error ? textError.message : String(textError),
				});
			}
		}
		return res; // Return the original response
	});

	return client; // Return the configured client instance
};

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
	} catch (e: unknown) {
		// Add type
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
		} catch (e: unknown) {
			// Add type
			console.error("Failed to parse request token from KV:", e);
			// パース失敗時は null のまま進み、後のチェックでエラーになる
		}
	}

	if (!requestTokenPair) {
		throw new Error("Request token not found or invalid");
	}

	const accessTokenPair = await fetchAccessToken({
		accessTokenEndpoint: zaimOAuthEndpoints.accessTokenEndpoint,
		consumerKey: env.ZAIM_CONSUMER_KEY,
		consumerSecret: env.ZAIM_CONSUMER_SECRET,
		oauthVerifier: oauthVerifier,
		requestToken: requestTokenPair,
	});
	console.log("Obtained Access Token Pair:", accessTokenPair); // デバッグ用

	// 使用済みのrequestTokenをKVから削除
	try {
		await env.ZAIM_AGENT_ZAIM_TOKENS_KV.delete(kvKeyRequest);
		console.log(`Deleted request token from KV: ${kvKeyRequest}`);
	} catch (e: unknown) {
		// Add type
		console.error("Failed to delete request token from KV:", e);
	}

	// Zaim APIクライアントを設定 (一時的なクライアント)
	const tempClient = configureZaimClient({
		accessToken: accessTokenPair.accessToken,
		accessTokenSecret: accessTokenPair.accessTokenSecret,
		consumerKey: env.ZAIM_CONSUMER_KEY,
		consumerSecret: env.ZAIM_CONSUMER_SECRET,
	});

	// ユーザー情報を検証 (一時的なクライアントを使用)
	// Pass the client instance via options
	const userResponse = await userVerifyUser({ client: tempClient });
	if (!userResponse || !userResponse.data || !userResponse.data.me) {
		throw new Error("Failed to verify Zaim user");
	}
	const user = userResponse.data.me;

	// OIDCのsubがあればアクセストークンをKVに保存
	if (oidcSub) {
		const kvKey = `${oidcSub}:zaim:oauth`;
		const kvValue = JSON.stringify({
			accessToken: accessTokenPair.accessToken,
			accessTokenSecret: accessTokenPair.accessTokenSecret,
			updatedAt: new Date().toISOString(),
		});
		try {
			await env.ZAIM_AGENT_ZAIM_TOKENS_KV.put(kvKey, kvValue);
			console.log(`Saved access token to KV for user: ${oidcSub}`);
		} catch (e: unknown) {
			// Add type
			console.error("Failed to save access token to KV:", e);
			throw new Error("Failed to save Zaim access token");
		}
	} else {
		console.log("No OIDC sub provided, skipping access token save.");
	}

	return { user };
};

/**
 * OIDC Subに紐づくZaimアクセストークンの存在を確認する
 */
export const checkZaimTokenExists = async (
	env: Env,
	oidcSub: string,
): Promise<boolean> => {
	const kvKey = `${oidcSub}:zaim:oauth`;
	const tokenString = await env.ZAIM_AGENT_ZAIM_TOKENS_KV.get(kvKey);
	return tokenString !== null;
};

/**
 * OIDC Sub に紐づくアクセストークンを取得する (外部利用向け)
 * @throws Error - アクセストークンが見つからない場合
 */
export const getZaimAccessToken = async (
	env: Env,
	oidcSub: string,
): Promise<{ accessToken: string; accessTokenSecret: string }> => {
	const kvKey = `${oidcSub}:zaim:oauth`;
	const tokenString = await env.ZAIM_AGENT_ZAIM_TOKENS_KV.get(kvKey);

	if (!tokenString) {
		throw new Error("Zaim access token not found for this user");
	}

	const token: {
		accessToken: string;
		accessTokenSecret: string;
		updatedAt: string; // Keep updatedAt for potential future use (e.g., token refresh logic)
	} = JSON.parse(tokenString);

	return {
		accessToken: token.accessToken,
		accessTokenSecret: token.accessTokenSecret,
	};
};
