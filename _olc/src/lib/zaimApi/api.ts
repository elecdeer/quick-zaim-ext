import ky from "ky";
import {
	oauthAccessTokenAtom,
	oauthConsumerKeyAtom,
	oauthConsumerSecretAtom,
} from "~features/authorize/authorizeAtoms";
import { createOAuthSigner } from "~lib/oauth";
import { jotaiStore } from "~lib/store";

export const zaimApi = ky.extend({
	prefixUrl: "https://api.zaim.net/v2",
	hooks: {
		beforeRequest: [
			async (request) => {
				const [consumerKey, consumerSecret, accessToken] = await Promise.all([
					jotaiStore.get(oauthConsumerKeyAtom),
					jotaiStore.get(oauthConsumerSecretAtom),
					jotaiStore.get(oauthAccessTokenAtom),
				]);

				if (!consumerKey || !consumerSecret || !accessToken) {
					throw new Error("認証情報がありません。");
				}

				const sign = createOAuthSigner({
					consumerKey,
					consumerSecret,
					accessToken: accessToken.accessToken,
					accessTokenSecret: accessToken.accessTokenSecret,
				});

				await sign(request);
			},
		],
		afterResponse: [
			(request, options, response) => {
				if (response.status === 401) {
					jotaiStore.set(oauthAccessTokenAtom, undefined);
					throw new Error("認証情報が無効です。");
				}
			},
		],
	},
});
