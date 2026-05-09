import { fakeBrowser } from "wxt/testing/fake-browser";

type BrowserMockOptions = {
  serverUrl?: string;
};

/**
 * Storybook 用 browser モックのセットアップ。
 * モックをリセットし、storage の初期値を注入する。
 * stories の loaders で await して呼び出すこと。
 *
 * NOTE: globalThis.chrome / globalThis.browser への fakeBrowser の割り当ては
 *       .storybook/preview.ts で事前に行う（wxt/browser のモジュール評価タイミングに合わせるため）。
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

  await fakeBrowser.storage.local.set({ serverUrl });
}
