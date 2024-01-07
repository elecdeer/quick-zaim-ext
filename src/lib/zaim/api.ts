import ky from "ky";
import { createOAuthSigner } from "~lib/oauth";
import {
  oauthAccessTokenStore,
  oauthConsumerKeyStore,
  oauthConsumerSecretStore,
} from "~lib/store";

export const zaimApi = ky.extend({
  prefixUrl: "https://api.zaim.net/v2",
  hooks: {
    beforeRequest: [
      async (request) => {
        const [consumerKey, consumerSecret, accessToken] = await Promise.all([
          oauthConsumerKeyStore.get(),
          oauthConsumerSecretStore.get(),
          oauthAccessTokenStore.get(),
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
  },
});
