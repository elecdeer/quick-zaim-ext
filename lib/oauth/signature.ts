import { oauthPercentEncode } from "./encode";
import type { OAuthHeader } from "./oauthHeader";

/**
 * 3.4.2. HMAC-SHA1 に基づくkeyの生成
 *
 * @see https://openid-foundation-japan.github.io/rfc5849.ja.html#anchor8
 */
export const createSignatureKey = (
	consumerSecret: string,
	tokenSecret: string | undefined,
) => {
	const encodedConsumerSecret = oauthPercentEncode(consumerSecret);
	const encodedTokenSecret = oauthPercentEncode(tokenSecret ?? "");
	return `${encodedConsumerSecret}&${encodedTokenSecret}`;
};

/**
 * 3.4.2. HMAC-SHA1 に基づくdigestの生成
 *
 * @see https://openid-foundation-japan.github.io/rfc5849.ja.html#anchor8
 */
export const signHMACSHA1 = async (
	baseSignatureString: string,
	key: string,
): Promise<string> => {
	const encoder = new TextEncoder();
	const keyData = encoder.encode(key);
	const message = encoder.encode(baseSignatureString);

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

/**
 * 3.4.1.  Signature Base String に基づくSignature Base Stringの生成
 *
 * @see https://openid-foundation-japan.github.io/rfc5849.ja.html#anchor6
 */
export const createSignatureBaseString = async (
	request: Request,
	oauthHeader: OAuthHeader | undefined,
) => {
	const parameters = await extractRequestParams(request, oauthHeader);

	return [
		request.method.toUpperCase(),
		oauthPercentEncode(createBaseStringUri(new URL(request.url))),
		oauthPercentEncode(normalizeRequestParameters(parameters)),
	].join("&");
};

/**
 * 3.4.1.2.  Base String URI に基づくBase String URIの生成
 */
export const createBaseStringUri = (url: URL) => {
	// URLオブジェクトは小文字への変換を行う
	// URLオブジェクトはデフォルトポートを省略する
	return url.origin + url.pathname;
};

/**
 * 3.4.1.3.  Request Parameters に基づく正規化されたリクエストパラメータの生成
 */
export const normalizeRequestParameters = (
	parameters: {
		name: string;
		value: string;
	}[],
) => {
	// 1. 名前と値をエンコード
	const encodedParameters = parameters.map(({ name, value }) => ({
		name: oauthPercentEncode(name),
		value: oauthPercentEncode(value),
	}));

	// 2. バイト値昇順でソート
	encodedParameters.sort((a, b) => {
		// 名前が同じ場合は値で比較
		if (a.name === b.name) {
			return a.value < b.value ? -1 : 1;
		}
		return a.name < b.name ? -1 : 1;
	});

	// 3. ソートされた名前と値を「名前=値」の形式で連結
	// 4. 連結した文字列を「&」で連結
	return encodedParameters
		.map(({ name, value }) => `${name}=${value}`)
		.join("&");
};

/**
 * 3.4.1.3.1.  Parameter Sources に基づくリクエストパラメータの取得
 */
export const extractRequestParams = async (
	request: Request,
	oauthHeader: OAuthHeader | undefined,
): Promise<
	{
		name: string;
		value: string;
	}[]
> => {
	// nameの重複も許容されるためMapは使えない
	const result: {
		name: string;
		value: string;
	}[] = [];

	// searchParams
	const searchParams = new URL(request.url).searchParams;
	for (const [name, value] of searchParams) {
		result.push({ name, value });
	}

	// Authorization header
	if (oauthHeader) {
		const authHeader = oauthHeader.extractBaseStringSourceParams();
		for (const { name, value } of authHeader) {
			result.push({ name, value });
		}
	}

	// Content-Typeがapplication/x-www-form-urlencodedだが、bodyがそれに準拠していない場合は想定しない
	if (
		request.headers.get("Content-Type") === "application/x-www-form-urlencoded"
	) {
		const body = await request.clone().text();
		const bodyParams = new URLSearchParams(body);
		for (const [name, value] of bodyParams) {
			result.push({ name, value });
		}
	}

	return result;
};
