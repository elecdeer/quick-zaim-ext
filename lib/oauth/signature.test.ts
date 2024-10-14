import { describe, expect, test } from "vitest";
import { OAuthHeader } from "./oauthHeader";
import {
	createBaseStringUri,
	createSignatureBaseString,
	extractRequestParams,
	normalizeRequestParameters,
} from "./signature";

describe("oauth", () => {
	describe("createSignatureBaseString", () => {
		test("example request", async () => {
			// https://openid-foundation-japan.github.io/rfc5849.ja.html#anchor6
			const requestUrl = new URL("/request", "http://example.com");
			requestUrl.searchParams.append("b5", "=%3D");
			requestUrl.searchParams.append("a3", "a");
			requestUrl.searchParams.append("c@", "");
			requestUrl.searchParams.append("a2", "r b");

			const authorizationHeader = new OAuthHeader([
				{ name: "realm", value: "Example" },
				{ name: "oauth_consumer_key", value: "9djdj82h48djs9d2" },
				{ name: "oauth_token", value: "kkk9d7dh3k39sjv7" },
				{ name: "oauth_signature_method", value: "HMAC-SHA1" },
				{ name: "oauth_timestamp", value: "137131201" },
				{ name: "oauth_nonce", value: "7d8f3e4a" },
				{ name: "oauth_signature", value: "bYT5CMsGcbgUdFHObYMEfcx6bsw%3D" },
			]);
			const headers = new Headers();
			// headers.set("Authorization", authorizationHeader.toString());
			headers.set("Content-Type", "application/x-www-form-urlencoded");

			const request = new Request(requestUrl, {
				method: "POST",
				headers,
				body: "c2&a3=2 q",
			});

			expect(
				await createSignatureBaseString(request, authorizationHeader),
			).toBe(
				"POST&http%3A%2F%2Fexample.com%2Frequest&a2%3Dr%2520b%26a3%3D2%2520q%26a3%3Da%26b5%3D%253D%25253D%26c%2540%3D%26c2%3D%26oauth_consumer_key%3D9djdj82h48djs9d2%26oauth_nonce%3D7d8f3e4a%26oauth_signature_method%3DHMAC-SHA1%26oauth_timestamp%3D137131201%26oauth_token%3Dkkk9d7dh3k39sjv7",
			);
		});
	});

	describe("createBaseStringUri", () => {
		test("example request", () => {
			// https://openid-foundation-japan.github.io/rfc5849.ja.html#anchor6 に記載の例

			const requestUrl = new URL("/r v/X?id=123", "http://EXAMPLE.COM:80");

			expect(createBaseStringUri(requestUrl)).toBe(
				"http://example.com/r%20v/X",
			);
		});

		test("example request 2", () => {
			// https://openid-foundation-japan.github.io/rfc5849.ja.html#anchor6 に記載の例

			const requestUrl = new URL("/?q=1", "https://www.example.net:8080");

			expect(createBaseStringUri(requestUrl)).toBe(
				"https://www.example.net:8080/",
			);
		});
	});

	describe("pickRequestParameters", () => {
		test("example request", async () => {
			const requestUrl = new URL("/request", "http://example.com");
			requestUrl.searchParams.append("b5", "=%3D");
			requestUrl.searchParams.append("a3", "a");
			requestUrl.searchParams.append("c@", "");
			requestUrl.searchParams.append("a2", "r b");

			const authorizationHeader = new OAuthHeader([
				{ name: "realm", value: "Example" },
				{ name: "oauth_consumer_key", value: "9djdj82h48djs9d2" },
				{ name: "oauth_token", value: "kkk9d7dh3k39sjv7" },
				{ name: "oauth_signature_method", value: "HMAC-SHA1" },
				{ name: "oauth_timestamp", value: "137131201" },
				{ name: "oauth_nonce", value: "7d8f3e4a" },
				{ name: "oauth_signature", value: "bYT5CMsGcbgUdFHObYMEfcx6bsw%3D" },
			]);
			const headers = new Headers();
			// headers.set("Authorization", authorizationHeader.toString());
			headers.set("Content-Type", "application/x-www-form-urlencoded");

			const request = new Request(requestUrl, {
				method: "POST",
				headers,
				body: "c2&a3=2 q",
			});

			const result = await extractRequestParams(request, authorizationHeader);

			expect(result).toEqual([
				{ name: "b5", value: "=%3D" },
				{ name: "a3", value: "a" },
				{ name: "c@", value: "" },
				{ name: "a2", value: "r b" },
				{ name: "oauth_consumer_key", value: "9djdj82h48djs9d2" },
				{ name: "oauth_token", value: "kkk9d7dh3k39sjv7" },
				{ name: "oauth_signature_method", value: "HMAC-SHA1" },
				{ name: "oauth_timestamp", value: "137131201" },
				{ name: "oauth_nonce", value: "7d8f3e4a" },
				{ name: "c2", value: "" },
				{ name: "a3", value: "2 q" },
			]);
		});
	});

	describe("normalizeRequestParameters", () => {
		test("example request", () => {
			const parameters = [
				{ name: "b5", value: "=%3D" },
				{ name: "a3", value: "a" },
				{ name: "c@", value: "" },
				{ name: "a2", value: "r b" },
				{ name: "oauth_consumer_key", value: "9djdj82h48djs9d2" },
				{ name: "oauth_token", value: "kkk9d7dh3k39sjv7" },
				{ name: "oauth_signature_method", value: "HMAC-SHA1" },
				{ name: "oauth_timestamp", value: "137131201" },
				{ name: "oauth_nonce", value: "7d8f3e4a" },
				{ name: "c2", value: "" },
				{ name: "a3", value: "2 q" },
			];

			const result = normalizeRequestParameters(parameters);

			expect(result).toBe(
				"a2=r%20b&a3=2%20q&a3=a&b5=%3D%253D&c%40=&c2=&oauth_consumer_key=9djdj82h48djs9d2&oauth_nonce=7d8f3e4a&oauth_signature_method=HMAC-SHA1&oauth_timestamp=137131201&oauth_token=kkk9d7dh3k39sjv7",
			);
		});
	});
});
