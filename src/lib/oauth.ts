import {
  createOAuthHeader,
  createSignature,
  createSignatureBaseString,
  createSignatureKey,
  generateNonce,
  generateTimestamp,
  parseOAuthTokenFromResponse,
} from "~lib/oauthHelper";

export type RequestTokenPair = {
  oauthToken: string;
  oauthTokenSecret: string;
};

export type AccessTokenPair = {
  accessToken: string;
  accessTokenSecret: string;
};

export type AuthorizationHeader = {
  Authorization: string;
};

export type OAuth = {
  fetchRequestToken: (params: {
    oauthCallback: string;
  }) => Promise<RequestTokenPair>;
  getAuthorizationUrl: (params: {
    oauthToken: RequestTokenPair["oauthToken"];
  }) => string;
  fetchAccessToken: (params: {
    requestToken: RequestTokenPair;
    oauthVerifier: string;
  }) => Promise<AccessTokenPair>;
  authorizeRequest: (params: {
    httpMethod: string;
    requestUrl: string;
    params: Record<string, string>;
    accessToken: AccessTokenPair;
  }) => Promise<AuthorizationHeader>;
};

export const createOAuth = ({
  consumerKey,
  consumerSecret,
  endpoints,
}: {
  consumerKey: string;
  consumerSecret: string;
  endpoints: {
    httpMethod: string;
    requestTokenUrl: string;
    userAuthorizationUrl: string;
    accessTokenUrl: string;
  };
}): OAuth => {
  const authorize = async ({
    url,
    httpMethod,
    params,
    tokenSecret,
  }: {
    url: string;
    httpMethod: string;
    params: Record<string, string>;
    tokenSecret: string | undefined;
  }) => {
    const nonce = generateNonce();
    const timestamp = generateTimestamp();

    const paramsWithoutSignature = {
      oauth_consumer_key: consumerKey,
      oauth_signature_method: "HMAC-SHA1",
      oauth_timestamp: timestamp,
      oauth_nonce: nonce,
      oauth_version: "1.0",
      ...params,
    };

    const signatureBaseString = createSignatureBaseString(
      httpMethod,
      url,
      paramsWithoutSignature,
    );

    const signatureKey = createSignatureKey(consumerSecret, tokenSecret);

    const oauthSignature = await createSignature(
      signatureBaseString,
      signatureKey,
    );

    const paramsWithSignature = {
      ...paramsWithoutSignature,
      oauth_signature: oauthSignature,
    };

    return createOAuthHeader(paramsWithSignature);
  };

  const fetchRequestToken: OAuth["fetchRequestToken"] = async ({
    oauthCallback,
  }) => {
    const params = {
      oauth_callback: oauthCallback,
    };

    const oauthHeader = await authorize({
      url: endpoints.requestTokenUrl,
      httpMethod: endpoints.httpMethod,
      params,
      tokenSecret: undefined,
    });

    const response = await fetch(endpoints.requestTokenUrl, {
      method: endpoints.httpMethod,
      headers: {
        ...oauthHeader,
      },
    });

    const responseText = await response.text();

    const { oauthToken, oauthTokenSecret } =
      parseOAuthTokenFromResponse(responseText);

    return {
      oauthToken: oauthToken,
      oauthTokenSecret: oauthTokenSecret,
    };
  };

  const getAuthorizationUrl: OAuth["getAuthorizationUrl"] = ({
    oauthToken,
  }) => {
    return `${endpoints.userAuthorizationUrl}?oauth_token=${oauthToken}`;
  };

  const fetchAccessToken: OAuth["fetchAccessToken"] = async ({
    requestToken,
    oauthVerifier,
  }) => {
    const params = {
      oauth_token: requestToken.oauthToken,
      oauth_verifier: oauthVerifier,
    };

    const oauthHeader = await authorize({
      url: endpoints.accessTokenUrl,
      httpMethod: endpoints.httpMethod,
      params,
      tokenSecret: requestToken.oauthTokenSecret,
    });

    const response = await fetch(endpoints.accessTokenUrl, {
      method: endpoints.httpMethod,
      headers: {
        ...oauthHeader,
      },
    });

    const responseText = await response.text();

    const { oauthToken, oauthTokenSecret } =
      parseOAuthTokenFromResponse(responseText);

    return {
      accessToken: oauthToken,
      accessTokenSecret: oauthTokenSecret,
    };
  };

  const authorizeRequest: OAuth["authorizeRequest"] = async ({
    httpMethod,
    requestUrl,
    params,
    accessToken,
  }) => {
    return await authorize({
      url: requestUrl,
      httpMethod,
      params: {
        ...params,
        oauth_token: accessToken.accessToken,
      },
      tokenSecret: accessToken.accessTokenSecret,
    });
  };

  return {
    fetchRequestToken,
    getAuthorizationUrl,
    fetchAccessToken,
    authorizeRequest,
  };
};

// // リクエストトークンの取得を試みる
// getRequestToken()
//   .then((token) => {
//     console.log("Received Token:", token);
//   })
//   .catch((error) => {
//     console.error("Error:", error);
//   });
