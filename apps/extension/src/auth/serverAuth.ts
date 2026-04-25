export async function launchServerLogin(serverUrl: string): Promise<void> {
  const redirectUri = chrome.identity.getRedirectURL();
  const authUrl = `${serverUrl}/auth/launch?redirect_uri=${encodeURIComponent(redirectUri)}`;
  await chrome.identity.launchWebAuthFlow({ url: authUrl, interactive: true });
}
