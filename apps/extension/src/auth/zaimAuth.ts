import * as v from "valibot";

const StartResponseSchema = v.object({ authorizeUrl: v.string() });

export async function launchZaimConnect(serverUrl: string): Promise<void> {
  const redirectUri = chrome.identity.getRedirectURL("zaim");

  const res = await fetch(
    `${serverUrl}/zaim/auth/start?ext_callback_uri=${encodeURIComponent(redirectUri)}`,
    { credentials: "include", redirect: "manual" },
  );
  if (!res.ok || res.type === "opaqueredirect") {
    throw new Error("Zaim 認証の開始に失敗しました");
  }
  const { authorizeUrl } = v.parse(StartResponseSchema, await res.json());

  const callbackUrl = await chrome.identity.launchWebAuthFlow({
    url: authorizeUrl,
    interactive: true,
  });
  if (!callbackUrl) {
    throw new Error("Zaim 認証に失敗しました");
  }

  const params = new URL(callbackUrl).searchParams;
  const oauthToken = params.get("oauth_token");
  const oauthVerifier = params.get("oauth_verifier");
  if (!oauthToken || !oauthVerifier) {
    throw new Error("Zaim 認証に失敗しました");
  }

  const exchangeRes = await fetch(
    `${serverUrl}/zaim/auth/exchange?oauth_token=${encodeURIComponent(oauthToken)}&oauth_verifier=${encodeURIComponent(oauthVerifier)}`,
    { credentials: "include" },
  );
  if (!exchangeRes.ok) {
    throw new Error("Zaim トークン交換に失敗しました");
  }
}
