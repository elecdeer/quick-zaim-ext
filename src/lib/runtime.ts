/**
 * 拡張機能のIDを取得する
 * @returns 拡張機能のID
 */
export const getExtensionId = (): string => {
  return chrome.runtime.id;
};
