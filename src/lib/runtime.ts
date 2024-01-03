export const OptionsPageUrl = "options.html";

/**
 * 拡張機能のIDを取得する
 * @returns 拡張機能のID
 */
export const getExtensionId = (): string => {
  return chrome.runtime.id;
};

/**
 * 拡張機能のURLを取得する
 */
export const getExtensionUrl = (path: string): string => {
  return chrome.runtime.getURL(path);
};

/**
 * 拡張機能のページを別タブで開く
 * 既に開いている場合はそのタブをアクティブにする
 */
export const openExtensionPage = async (path: string): Promise<void> => {
  const extensionUrl = getExtensionUrl(path);

  const tabs = await chrome.tabs.query({
    url: extensionUrl,
    currentWindow: true,
  });

  if (tabs[0]?.id !== undefined) {
    await chrome.tabs.update(tabs[0].id, { active: true, highlighted: true });
  } else {
    await chrome.tabs.create({ url: extensionUrl });
  }
};
