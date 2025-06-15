import { fetchAccessToken, fetchRequestToken } from "@repo/oauth";
import { userVerifyUser } from "@repo/zaim-api";
import type { UserVerifyUserResponse } from "@repo/zaim-api";
import type { Client } from "@repo/zaim-api/client";
import type { Env } from "../../env";
import { type Result, err, isErr, ok } from "../../result";
import { getZaimRepository } from "./repository";
import type { ZaimServiceError } from "./types";
import { createZaimClient } from "./zaimClient";

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

/**
 * Zaimログイン用の認証URLを取得する
 */
export const getZaimLoginUrl = async ({
	env,
	userId,
	returnTo,
}: {
	env: Env;
	userId: string;
	returnTo?: string | undefined;
}): Promise<{
	userAuthorizeUrl: string;
}> => {
	const requestToken = await fetchRequestToken({
		requestTokenEndpoint: zaimOAuthEndpoints.requestTokenEndpoint,
		consumerKey: env.ZAIM_CONSUMER_KEY,
		consumerSecret: env.ZAIM_CONSUMER_SECRET,
		callbackUrl: env.ZAIM_CALLBACK_URL,
	});

	const userAuthorizeUrl = new URL(zaimOAuthEndpoints.authorizeEndpoint.url);
	userAuthorizeUrl.searchParams.append("oauth_token", requestToken.oauthToken);

	// requestTokenをKVに保存 (TTL: 10分 = 600秒)
	const repository = getZaimRepository(env, userId);
	await repository.saveTemporalRequestToken(
		{
			oauthToken: requestToken.oauthToken,
			oauthTokenSecret: requestToken.oauthTokenSecret,
			returnTo: returnTo ?? null,
		},
		{ expirationSeconds: 600 },
	);

	return {
		userAuthorizeUrl: userAuthorizeUrl.toString(),
	};
};

/**
 * Zaim OAuthコールバックを処理する
 */
export const handleZaimCallback = async ({
	env,
	oauthToken,
	oauthVerifier,
	userId,
}: {
	env: Env;
	oauthToken: string;
	oauthVerifier: string;
	userId: string;
}): Promise<
	Result<
		{
			user: UserVerifyUserResponse["me"];
			returnTo: string | undefined;
		},
		ZaimServiceError
	>
> => {
	const repository = getZaimRepository(env, userId);

	const requestTokenPairResult =
		await repository.readTemporalRequestToken(oauthToken);

	if (isErr(requestTokenPairResult)) {
		return err({
			code: "INVALID_REQUEST",
			statusCode: 400,
			message: "Request token not found.",
			cause: requestTokenPairResult,
		});
	}

	const accessTokenPair = await fetchAccessToken({
		accessTokenEndpoint: zaimOAuthEndpoints.accessTokenEndpoint,
		consumerKey: env.ZAIM_CONSUMER_KEY,
		consumerSecret: env.ZAIM_CONSUMER_SECRET,
		oauthVerifier: oauthVerifier,
		requestToken: requestTokenPairResult.value,
	});

	// 使用済みのrequestTokenをKVから削除
	await repository.expireTemporalRequestToken(oauthToken);
	// Zaim APIクライアントを設定 (一時的なクライアント)
	const tempClient = createZaimClient({
		accessToken: accessTokenPair.accessToken,
		accessTokenSecret: accessTokenPair.accessTokenSecret,
		consumerKey: env.ZAIM_CONSUMER_KEY,
		consumerSecret: env.ZAIM_CONSUMER_SECRET,
	});

	// ユーザー情報を検証 (一時的なクライアントを使用)
	const userResponse = await userVerifyUser({ client: tempClient });
	if (!userResponse || !userResponse.data) {
		return err({
			code: "ZAIM_API_ERROR",
			statusCode: 500,
			message: "Failed to verify user from Zaim API.",
			cause: userResponse.error,
		});
	}

	const user = userResponse.data.me;

	await repository.saveAccessToken({
		accessToken: accessTokenPair.accessToken,
		accessTokenSecret: accessTokenPair.accessTokenSecret,
	});

	return ok({
		user,
		returnTo: requestTokenPairResult.value.returnTo ?? undefined,
	});
};

/**
 * ユーザに紐付くZaim APIクライアントを取得する
 */
export const getUserZaimClient = async (
	env: Env,
	userId: string,
): Promise<Result<Client, ZaimServiceError>> => {
	const repository = getZaimRepository(env, userId);
	const tokenResult = await repository.readAccessToken();
	if (isErr(tokenResult)) {
		return err({
			code: "ZAIM_AUTH_ERROR",
			statusCode: 401,
			message: "Zaim access token not found.",
			cause: tokenResult,
		});
	}

	return ok(
		createZaimClient({
			accessToken: tokenResult.value.accessToken,
			accessTokenSecret: tokenResult.value.accessTokenSecret,
			consumerKey: env.ZAIM_CONSUMER_KEY,
			consumerSecret: env.ZAIM_CONSUMER_SECRET,
		}),
	);
};
