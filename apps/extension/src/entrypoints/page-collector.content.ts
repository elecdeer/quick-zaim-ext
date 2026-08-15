import { defineContentScript } from "#imports";
import { generateAriaTree, renderAriaTree } from "../page-collector/ariaSnapshot.ts";
import {
  type CollectPageContentResponse,
  isCollectPageContentRequest,
} from "../page-collector/messaging.ts";

/**
 * ページ収集用 content script。
 * 自動注入はせず、sidepanel から chrome.scripting.executeScript で注入してから
 * chrome.tabs.sendMessage で収集をリクエストする運用を想定している。
 */
export default defineContentScript({
  matches: [],
  registration: "runtime",
  main() {
    chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
      if (!isCollectPageContentRequest(msg)) return false;
      try {
        const tree = generateAriaTree(document.body, msg.options);
        const response: CollectPageContentResponse = {
          ok: true,
          url: location.href,
          title: document.title,
          ariaSnapshot: renderAriaTree(tree),
          ariaTree: tree,
          collectedAt: new Date().toISOString(),
        };
        sendResponse(response);
      } catch (error) {
        const response: CollectPageContentResponse = {
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        };
        sendResponse(response);
      }
      return false;
    });
  },
});
