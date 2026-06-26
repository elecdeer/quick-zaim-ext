import type { Env } from "../../env.ts";
import type { Logger } from "../../loggerMiddleware.ts";
import { fetchZaimAccessToken, fetchZaimUserId } from "../../zaim-oauth.ts";
import { getRequestTokenState, saveAccessToken, deleteRequestToken } from "./repository.ts";

/**
 * oauth_token + oauth_verifier からアクセストークンを取得して KV に保存する。
 */
export const performZaimTokenExchange = async (
  env: Env,
  oauthToken: string,
  oauthVerifier: string,
  logger: Logger,
): Promise<{ zaimUserId: string; extRedirectUri?: string }> => {
  logger.with({ oauthToken }).debug("Looking up request token state from KV: {oauthToken}");

  const state = await getRequestTokenState(env.ZAIM_KV, oauthToken);
  if (!state) {
    logger.with({ oauthToken }).warn("Request token not found or expired in KV: {oauthToken}");
    throw new Error("Request token not found or expired");
  }

  const { tokenSecret, userSub, extRedirectUri } = state;

  logger
    .with({ userSub, oauthToken })
    .debug("Request token state found for user {userSub}, starting access token exchange");

  const accessConfig = {
    consumerKey: env.ZAIM_CONSUMER_KEY,
    consumerSecret: env.ZAIM_CONSUMER_SECRET,
    token: oauthToken,
    tokenSecret,
  };

  const { oauthToken: accessToken, oauthTokenSecret } = await fetchZaimAccessToken(
    accessConfig,
    oauthVerifier,
    logger,
  );

  const accessTokenConfig = {
    consumerKey: env.ZAIM_CONSUMER_KEY,
    consumerSecret: env.ZAIM_CONSUMER_SECRET,
    token: accessToken,
    tokenSecret: oauthTokenSecret,
  };

  const zaimUserId = await fetchZaimUserId(accessTokenConfig, logger);

  logger
    .with({ userSub, zaimUserId })
    .info("Access token obtained for user {userSub} (Zaim user {zaimUserId}), saving to KV");

  await saveAccessToken(env.ZAIM_KV, userSub, {
    oauthToken: accessToken,
    oauthTokenSecret,
    zaimUserId,
  });
  await deleteRequestToken(env.ZAIM_KV, oauthToken);

  logger
    .with({ userSub, zaimUserId })
    .debug("Token exchange complete: access token stored, request token deleted");

  return { zaimUserId, extRedirectUri };
};
