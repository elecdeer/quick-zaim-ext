import {
  type CollectPageContentRequest,
  type CollectPageContentResponse,
  PAGE_COLLECTOR_MESSAGE_TYPE,
} from "./messaging.ts";

/**
 * 現在アクティブなタブに page-collector content script を注入し、
 * ページ内容（ARIA snapshot）を取得して返す。
 *
 * 失敗時 (タブ未取得・content script 例外・タブが拡張機能で読み込めないページ等) は throw する。
 */
export const collectFromActiveTab = async (): Promise<
  Extract<CollectPageContentResponse, { ok: true }>
> => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const tabId = tab?.id;
  if (typeof tabId !== "number") {
    throw new Error("アクティブなタブが見つかりません");
  }

  await chrome.scripting.executeScript({
    target: { tabId },
    files: ["content-scripts/page-collector.js"],
  });

  const request: CollectPageContentRequest = { type: PAGE_COLLECTOR_MESSAGE_TYPE };
  const response = (await chrome.tabs.sendMessage(tabId, request)) as
    | CollectPageContentResponse
    | undefined;

  if (!response) {
    throw new Error("content script から応答がありませんでした");
  }
  if (!response.ok) {
    throw new Error(response.error || "ページ内容の取得に失敗しました");
  }
  return response;
};
