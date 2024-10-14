import { OAuthHeader } from "./oauthHeader";
import {
	createSignatureBaseString,
	createSignatureKey,
	signHMACSHA1,
} from "./signature";

export type Endpoint = {
	method: string;
	url: string;
};

export type AuthorizationHeader = {
	Authorization: string;
};

export const parseOAuthTokenFromResponse = (response: string) => {
	const params = new URLSearchParams(response);
	const oauthToken = params.get("oauth_token");
	const oauthTokenSecret = params.get("oauth_token_secret");

	if (oauthToken === null || oauthTokenSecret === null) {
		throw new Error("Failed to parse OAuth token");
	}

	return {
		oauthToken,
		oauthTokenSecret,
	};
};

/**
 * Nonceとして使うランダムな文字列を生成
 *
 * @see https://openid-foundation-japan.github.io/rfc5849.ja.html#nonce
 */
export const generateNonce = (): string => {
	return crypto.randomUUID();
};

/**
 * タイムスタンプを生成
 * UNIX時間を秒単位で返す
 *
 * @see https://openid-foundation-japan.github.io/rfc5849.ja.html#nonce
 */
export const generateTimestamp = (): string => {
	return Math.floor(Date.now() / 1000).toString();
};

export const authorizeRequest = async ({
	request,
	authorizationHeader = new OAuthHeader([]),
	consumerKey,
	consumerSecret,
	tokenSecret,
}: {
	request: Request;
	authorizationHeader: OAuthHeader | undefined;
	consumerKey: string;
	consumerSecret: string;
	tokenSecret: string | undefined;
}): Promise<Request> => {
	const nonce = generateNonce();
	const timestamp = generateTimestamp();

	authorizationHeader.append("oauth_consumer_key", consumerKey);
	authorizationHeader.append("oauth_signature_method", "HMAC-SHA1");
	authorizationHeader.append("oauth_timestamp", timestamp);
	authorizationHeader.append("oauth_nonce", nonce);
	authorizationHeader.append("oauth_version", "1.0");

	const preAuthorizeRequest = new Request(request);

	const signatureBaseString = await createSignatureBaseString(
		preAuthorizeRequest,
		authorizationHeader,
	);
	const signatureKey = createSignatureKey(consumerSecret, tokenSecret);
	const oauthSignature = await signHMACSHA1(signatureBaseString, signatureKey);

	authorizationHeader.append("oauth_signature", oauthSignature);

	const headers = new Headers({
		...request.headers,
		Authorization: authorizationHeader.toString(),
	});
	return new Request(preAuthorizeRequest, {
		headers,
	});
};
