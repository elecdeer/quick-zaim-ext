import { oauthPercentEncode } from "./encode";

type OAuthParameter =
	| "realm"
	| "oauth_consumer_key"
	| "oauth_token"
	| "oauth_signature_method"
	| "oauth_timestamp"
	| "oauth_nonce"
	| "oauth_version"
	| "oauth_signature";

/**
 * 3.5.1. Authorization Header に基づくOAuthヘッダ
 */
export class OAuthHeader {
	constructor(
		private oauthParams: {
			name: OAuthParameter | (string & {});
			value: string;
		}[],
	) {}

	/**
	 * OAuthパラメータを追加
	 */
	append(key: OAuthParameter | (string & {}), value: string) {
		this.oauthParams.push({ name: key, value });
	}

	/**
	 * Signature base stringを生成するためのパラメータを取得
	 *
	 * encodeは行われていない
	 */
	extractBaseStringSourceParams(): { name: string; value: string }[] {
		return this.oauthParams.filter(
			({ name }) => name !== "realm" && name !== "oauth_signature",
		);
	}

	/**
	 * Authorizationヘッダの文字列を生成
	 */
	toString() {
		const values = this.oauthParams.map(
			({ name, value }) =>
				`${oauthPercentEncode(name)}="${oauthPercentEncode(value)}"`,
		);

		return `OAuth ${values.join(", ")}`;
	}
}
