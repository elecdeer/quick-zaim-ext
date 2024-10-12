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

/**
 * 現在開いているのURLを取得する
 * @returns 現在のタブのURL
 */
export const getCurrentTabUrl = async (): Promise<string | undefined> => {
	const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
	return tabs[0]?.url;
};

/**
 * sendToContentScriptによって送信されたメッセージへのリスナーを追加する
 * @param handler
 */
export const addMessageListener = (
	handler: (
		message: { name: string },
		sender: chrome.runtime.MessageSender,
		sendResponse: (response: unknown) => void,
	) => void,
): void => {
	chrome.runtime.onMessage.addListener(handler);
};
