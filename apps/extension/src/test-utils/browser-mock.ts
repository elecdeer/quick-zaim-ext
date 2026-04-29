import { fakeBrowser } from "wxt/testing/fake-browser";

type BrowserMockOptions = {
  serverUrl?: string;
};

/**
 * Storybook 用 browser モックのセットアップ。
 * fakeBrowser を globalThis.chrome に設定し、storage の初期値を注入する。
 * stories の loaders で await して呼び出すこと。
 */
export async function setupBrowserMock({
  serverUrl = "http://mock-server.test",
}: BrowserMockOptions = {}): Promise<void> {
  fakeBrowser.reset();

  // identity は @webext-core/fake-browser で未実装のためオーバーライドする。
  // chrome.identity は Chrome 固有 API で WebExtension 標準外のため fakeBrowser に含まれない。
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (fakeBrowser as any).identity = {
    getRedirectURL: (path?: string) => `https://mock.chromiumapp.org/${path ?? "redirect"}`,
    launchWebAuthFlow: () => Promise.resolve("https://mock.chromiumapp.org/redirect"),
  };

  // @wxt-dev/browser は globalThis.browser が未設定の場合 globalThis.chrome にフォールバックするため、
  // fakeBrowser を chrome グローバルとして登録することで wxt/browser の browser が fakeBrowser を指すようにする。
  globalThis.chrome = fakeBrowser as unknown as typeof chrome;

  await fakeBrowser.storage.local.set({ serverUrl });
}
