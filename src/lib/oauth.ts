import {
  type AuthorizationHeader,
  type Endpoint,
  authorizeRequest,
  constructUrlWithParams,
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
  const { headers, request } = await authorizeRequest({
    request: {
      url: requestTokenEndpoint.url,
      method: requestTokenEndpoint.method,
      params: {
        oauth_callback: "oob",
      },
    },
    consumerKey,
    consumerSecret,
    tokenSecret: undefined,
  });

  const urlWithParams = constructUrlWithParams(request.url, request.params);
  const response = await fetch(urlWithParams, {
    method: request.method,
    headers: headers,
  });

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
  const params = {
    oauth_token: requestToken.oauthToken,
    oauth_verifier: oauthVerifier,
  };

  const { request, headers } = await authorizeRequest({
    request: {
      url: accessTokenEndpoint.url,
      method: accessTokenEndpoint.method,
      params,
    },
    consumerKey,
    consumerSecret,
    tokenSecret: requestToken.oauthTokenSecret,
  });

  const urlWithParams = constructUrlWithParams(request.url, request.params);
  const response = await fetch(urlWithParams, {
    method: accessTokenEndpoint.method,
    headers: headers,
  });

  const responseText = await response.text();

  const { oauthToken, oauthTokenSecret } =
    parseOAuthTokenFromResponse(responseText);

  return {
    accessToken: oauthToken,
    accessTokenSecret: oauthTokenSecret,
  };
};

type Request = {
  url: string;
  method: string;
  params: Record<string, string>;
};

export type OAuthSign = (request: Request) => Promise<{
  headers: AuthorizationHeader;
  request: Request;
}>;

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
  return async ({
    url,
    method,
    params,
  }: {
    url: string;
    method: string;
    params: Record<string, string>;
  }) => {
    const request = {
      url,
      method,
      params: {
        ...params,
        oauth_token: accessToken,
      },
    };

    return await authorizeRequest({
      request,
      consumerKey,
      consumerSecret,
      tokenSecret: accessTokenSecret,
    });
  };
};
