import {
	type Endpoint,
	authorizeRequest,
	parseOAuthTokenFromResponse,
} from "./oauth";
import { OAuthHeader } from "./oauthHeader";

export type RequestTokenPair = {
	oauthToken: string;
	oauthTokenSecret: string;
};

export type AccessTokenPair = {
	accessToken: string;
	accessTokenSecret: string;
};

export type OAuthApplicant = {
	obtainAccessToken: () => Promise<AccessTokenPair>;
};

// TODO headerの計算に使ったparamsって実際に渡さなくていいんだっけ？
// zaimは渡さなくても通っているように見える

/** @deprecated */
export const createOAuthApplicant = ({
	consumerKey,
	consumerSecret,
	requestTokenEndpoint,
	authorizeEndpoint,
	accessTokenEndpoint,
	waitUserAuthorize,
}: {
	consumerKey: string;
	consumerSecret: string;
	requestTokenEndpoint: Endpoint;
	authorizeEndpoint: Omit<Endpoint, "method">;
	accessTokenEndpoint: Endpoint;
	waitUserAuthorize: (userAuthorizeUrl: string) => Promise<string>;
}): OAuthApplicant => {
	return {
		obtainAccessToken: async () => {
			const requestToken = await fetchRequestToken({
				requestTokenEndpoint,
				consumerKey,
				consumerSecret,
				callbackUrl: "oob",
			});

			const oauthVerifier = await userAuthorize({
				authorizeEndpoint,
				requestToken,
				waitUserAuthorize,
			});

			const accessToken = await fetchAccessToken({
				accessTokenEndpoint,
				oauthVerifier,
				consumerKey,
				consumerSecret,
				requestToken,
			});

			return accessToken;
		},
	};
};

export const fetchRequestToken = async ({
	requestTokenEndpoint,
	consumerKey,
	consumerSecret,
	callbackUrl,
}: {
	requestTokenEndpoint: Endpoint;
	consumerKey: string;
	consumerSecret: string;
	callbackUrl: string;
}): Promise<RequestTokenPair> => {
	const authorizedRequest = await authorizeRequest({
		request: new Request(requestTokenEndpoint.url, {
			method: requestTokenEndpoint.method,
		}),
		authorizationHeader: new OAuthHeader([
			{ name: "oauth_callback", value: callbackUrl },
		]),
		consumerKey,
		consumerSecret,
		tokenSecret: undefined,
	});

	const response = await fetch(authorizedRequest);

	const responseText = await response.text();

	const { oauthToken, oauthTokenSecret } =
		parseOAuthTokenFromResponse(responseText);

	return { oauthToken, oauthTokenSecret };
};

const userAuthorize = async ({
	authorizeEndpoint,
	requestToken,
	waitUserAuthorize,
}: {
	authorizeEndpoint: Omit<Endpoint, "method">;
	requestToken: Pick<RequestTokenPair, "oauthToken">;
	waitUserAuthorize: (userAuthorizeUrl: string) => Promise<string>;
}): Promise<string> => {
	const userAuthorizeUrl = new URL(authorizeEndpoint.url);
	userAuthorizeUrl.searchParams.set("oauth_token", requestToken.oauthToken);

	// TODO: ここもAuthorization Headerに入れるようにする方が良いかも
	const oauthVerifier = await waitUserAuthorize(userAuthorizeUrl.toString());

	return oauthVerifier;
};

export const fetchAccessToken = async ({
	accessTokenEndpoint,
	oauthVerifier,
	consumerKey,
	consumerSecret,
	requestToken,
}: {
	accessTokenEndpoint: Endpoint;
	oauthVerifier: string;
	consumerKey: string;
	consumerSecret: string;
	requestToken: RequestTokenPair;
}): Promise<AccessTokenPair> => {
	const request = new Request(accessTokenEndpoint.url, {
		method: accessTokenEndpoint.method,
	});
	const authorizedRequest = await authorizeRequest({
		request,
		authorizationHeader: new OAuthHeader([
			{ name: "oauth_token", value: requestToken.oauthToken },
			{ name: "oauth_verifier", value: oauthVerifier },
		]),
		consumerKey,
		consumerSecret,
		tokenSecret: requestToken.oauthTokenSecret,
	});

	const response = await fetch(authorizedRequest);

	const responseText = await response.text();

	const { oauthToken, oauthTokenSecret } =
		parseOAuthTokenFromResponse(responseText);

	return {
		accessToken: oauthToken,
		accessTokenSecret: oauthTokenSecret,
	};
};

/**
 * requestからOAuth署名を作成し、署名済みのRequestを返す
 */
export type OAuthSign = (request: Request) => Promise<Request>;

export const createOAuthSigner = ({
	consumerKey,
	consumerSecret,
	accessToken,
	accessTokenSecret,
}: {
	consumerKey: string;
	consumerSecret: string;
	accessToken: string;
	accessTokenSecret: string;
}): OAuthSign => {
	return async (request) => {
		return await authorizeRequest({
			request,
			authorizationHeader: new OAuthHeader([
				{ name: "oauth_token", value: accessToken },
			]),
			consumerKey,
			consumerSecret,
			tokenSecret: accessTokenSecret,
		});
	};
};
