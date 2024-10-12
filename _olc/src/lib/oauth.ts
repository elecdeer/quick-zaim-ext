import {
	type Endpoint,
	authorizeRequest,
	parseOAuthTokenFromResponse,
} from "./oauthHelper";

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

const fetchRequestToken = async ({
	requestTokenEndpoint,
	consumerKey,
	consumerSecret,
}: {
	requestTokenEndpoint: Endpoint;
	consumerKey: string;
	consumerSecret: string;
}): Promise<RequestTokenPair> => {
	const requestUrl = new URL(requestTokenEndpoint.url);
	requestUrl.searchParams.set("oauth_callback", "oob");

	const { authorizedRequest } = await authorizeRequest({
		request: new Request(requestUrl.toString(), {
			method: requestTokenEndpoint.method,
		}),
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

	const oauthVerifier = await waitUserAuthorize(userAuthorizeUrl.toString());

	return oauthVerifier;
};

const fetchAccessToken = async ({
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
	const requestUrl = new URL(accessTokenEndpoint.url);
	requestUrl.searchParams.set("oauth_token", requestToken.oauthToken);
	requestUrl.searchParams.set("oauth_verifier", oauthVerifier);

	const request = new Request(requestUrl, {
		method: accessTokenEndpoint.method,
	});
	const { authorizedRequest } = await authorizeRequest({
		request,
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
 * requestからOAuth署名を作成し、requestにAuthorizationヘッダーを付与する
 */
export type OAuthSign = (request: Request) => Promise<void>;

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
		const urlWithTokenParam = new URL(request.url);
		urlWithTokenParam.searchParams.set("oauth_token", accessToken);
		const requestWithToken = new Request(urlWithTokenParam, {
			method: request.method,
		});

		const { headers } = await authorizeRequest({
			request: requestWithToken,
			consumerKey,
			consumerSecret,
			tokenSecret: accessTokenSecret,
		});

		// 引数のrequestに対してAuthorizationヘッダーを付与する
		request.headers.set("Authorization", headers.Authorization);
	};
};
