import { describe, expect, test } from "vitest";
import { OAuthHeader } from "./oauthHeader";

describe("OAuthHeader", () => {
	test("OAuthパラメータを追加", () => {
		const header = new OAuthHeader([]);
		header.append("oauth_consumer_key", "testKey");
		expect(header.toString()).toBe('OAuth oauth_consumer_key="testKey"');
	});

	test("Signature base stringを生成するためのパラメータを取得", () => {
		const header = new OAuthHeader([
			{ name: "oauth_consumer_key", value: "testKey" },
			{ name: "realm", value: "testRealm" },
			{ name: "oauth_signature", value: "testSignature" },
		]);
		const baseStringParams = header.extractBaseStringSourceParams();
		expect(baseStringParams).toEqual([
			{ name: "oauth_consumer_key", value: "testKey" },
		]);
	});

	test("Authorizationヘッダの文字列を生成", () => {
		const header = new OAuthHeader([
			{ name: "oauth_consumer_key", value: "testKey" },
			{ name: "oauth_token", value: "testToken" },
		]);
		expect(header.toString()).toBe(
			'OAuth oauth_consumer_key="testKey", oauth_token="testToken"',
		);
	});
});
