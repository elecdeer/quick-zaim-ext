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
		oauthToken: oauthToken,
		oauthTokenSecret: oauthTokenSecret,
	};
};

export const generateNonce = (): string => {
	return crypto.randomUUID();
};

export const generateTimestamp = (): string => {
	return Math.floor(Date.now() / 1000).toString();
};

/**
 * Create signature base string
 * @see https://openid-foundation-japan.github.io/rfc5849.ja.html#anchor6
 *
 * @param httpMethod
 * @param requestUri
 * @param params
 */
export const createSignatureBaseString = (
	httpMethod: string,
	requestUrl: URL,
) => {
	const url = new URL(requestUrl);

	// 仕様上ソートは必須
	url.searchParams.sort();

	const urlWithoutParams = url.origin + url.pathname;

	// searchParamsは半角スペースを+にエンコードするが、OAuthでは%20を使うので置換
	// https://openid-foundation-japan.github.io/rfc5849.ja.html#encoding
	return [
		httpMethod.toUpperCase(),
		encodeURIComponent(urlWithoutParams),
		encodeURIComponent(url.searchParams.toString().replaceAll("+", "%20")),
	].join("&");
};

export const createSignatureKey = (
	consumerSecret: string,
	tokenSecret: string | undefined,
) => {
	const encodedConsumerSecret = encodeURIComponent(consumerSecret);
	const encodedTokenSecret = encodeURIComponent(tokenSecret ?? "");
	return [encodedConsumerSecret, encodedTokenSecret].join("&");
};

// 署名の生成
export const createSignature = async (baseString: string, key: string) => {
	const encoder = new TextEncoder();
	const keyData = encoder.encode(key);
	const message = encoder.encode(baseString);

	const cryptoKey = await crypto.subtle.importKey(
		"raw",
		keyData,
		{ name: "HMAC", hash: "SHA-1" },
		false,
		["sign"],
	);
	const signature = await crypto.subtle.sign("HMAC", cryptoKey, message);
	return btoa(String.fromCharCode(...new Uint8Array(signature)));
};

// OAuthヘッダの作成
export const constructOAuthHeader = (
	params: URLSearchParams,
): AuthorizationHeader => {
	const values = Array.from(params.entries()).map(([key, value]) => {
		return `${encodeURIComponent(key)}="${encodeURIComponent(value)}"`;
	});

	return {
		Authorization: `OAuth ${values.join(", ")}`,
	};
};

export const authorizeRequest = async ({
	request,
	consumerKey,
	consumerSecret,
	tokenSecret,
}: {
	request: Request;
	consumerKey: string;
	consumerSecret: string;
	tokenSecret: string | undefined;
}) => {
	const nonce = generateNonce();
	const timestamp = generateTimestamp();

	const url = new URL(request.url);
	// 既存のは引き継ぐ
	const params = url.searchParams;
	params.set("oauth_consumer_key", consumerKey);
	params.set("oauth_signature_method", "HMAC-SHA1");
	params.set("oauth_timestamp", timestamp);
	params.set("oauth_nonce", nonce);
	params.set("oauth_version", "1.0");
	params.sort();

	const signatureBaseString = createSignatureBaseString(request.method, url);

	const signatureKey = createSignatureKey(consumerSecret, tokenSecret);

	const oauthSignature = await createSignature(
		signatureBaseString,
		signatureKey,
	);

	params.set("oauth_signature", oauthSignature);
	params.sort();

	const authorizedRequest = new Request(url, {
		method: request.method,
	});

	const headers = constructOAuthHeader(params);
	authorizedRequest.headers.set("Authorization", headers.Authorization);

	return {
		headers,
		authorizedRequest,
	};
};

export const objectToSearchParams = <TKeys extends string>(
	params: Partial<Record<TKeys, string | number | undefined>>,
): URLSearchParams => {
	const urlSearchParams = new URLSearchParams();
	for (const [key, value] of Object.entries(params)) {
		if (typeof value === "number") {
			urlSearchParams.set(key, encodeURIComponent(value.toString()));
		}
		if (typeof value === "string") {
			urlSearchParams.set(key, value);
		}
		// それ以外は無視
	}
	return urlSearchParams;
};
