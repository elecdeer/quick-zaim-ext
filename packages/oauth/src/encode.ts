/**
 * 3.6 Percent Encodingに基づく文字列のエンコード
 *
 * @see https://openid-foundation-japan.github.io/rfc5849.ja.html#encoding
 */
export const oauthPercentEncode = (str: string): string => {
	return encodeURIComponent(str)
		.replace(/!/g, "%21")
		.replace(/'/g, "%27")
		.replace(/\(/g, "%28")
		.replace(/\)/g, "%29")
		.replace(/\*/g, "%2A");
};
