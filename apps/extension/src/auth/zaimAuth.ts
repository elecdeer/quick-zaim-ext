import * as v from "valibot";

const StartResponseSchema = v.object({ authorizeUrl: v.string() });

export async function launchZaimConnect(serverUrl: string): Promise<void> {
  const extRedirectUri = chrome.identity.getRedirectURL("zaim");

  // Step 1: サーバーから Zaim 認可 URL を取得（OIDC セッションは通常の fetch で送信）
  const res = await fetch(
    `${serverUrl}/zaim/auth/start?ext_redirect_uri=${encodeURIComponent(extRedirectUri)}`,
    { credentials: "include", redirect: "manual" },
  );
  if (!res.ok || res.type === "opaqueredirect") {
    throw new Error("Zaim 認証の開始に失敗しました");
  }
  const { authorizeUrl } = v.parse(StartResponseSchema, await res.json());

  // Step 2: Zaim 認可フロー
  // popup: Zaim 認可画面 → /zaim/auth/callback（サーバーがトークン交換）→ extRedirectUri
  // launchWebAuthFlow が chromiumapp.org へのリダイレクトを検知して完了
  const result = await chrome.identity.launchWebAuthFlow({
    url: authorizeUrl,
    interactive: true,
  });
  if (!result) {
    throw new Error("Zaim 認証に失敗しました");
  }
}
