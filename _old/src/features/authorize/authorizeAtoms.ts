import type { AccessTokenPair } from "~lib/oauth";
import { atomWithExtensionSecureStorage } from "~lib/store";

export const oauthConsumerKeyAtom = atomWithExtensionSecureStorage<string>(
	"oauth-consumer-key",
	"",
);

export const oauthConsumerSecretAtom = atomWithExtensionSecureStorage<string>(
	"oauth-consumer-secret",
	"",
);

export const oauthAccessTokenAtom = atomWithExtensionSecureStorage<
	AccessTokenPair | undefined
>("oauth-access-token", undefined);
