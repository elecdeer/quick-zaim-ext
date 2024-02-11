import type { AccessTokenPair } from "~lib/oauth";
import { atomWithExtensionSecureStorage, keyPrefix } from "~lib/store";

export const oauthConsumerKeyAtom = atomWithExtensionSecureStorage<string>(
  `${keyPrefix}-oauth-consumer-key`,
  ""
);

export const oauthConsumerSecretAtom = atomWithExtensionSecureStorage<string>(
  `${keyPrefix}-oauth-consumer-secret`,
  ""
);

export const oauthAccessTokenAtom = atomWithExtensionSecureStorage<
  AccessTokenPair | undefined
>(`${keyPrefix}-oauth-access-token`, undefined);
