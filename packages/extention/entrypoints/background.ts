import { browser } from "wxt/browser";
import { defineBackground } from "wxt/utils/define-background";

export default defineBackground(() => {
	console.log("Hello background!", { id: browser.runtime.id });

	// アクションボタンクリック時にサイドパネルを開く
	browser.action.onClicked.addListener(async (tab) => {
		console.log("Action button clicked", tab);
		
		try {
			// サイドパネルを開く
			await browser.sidePanel.open({
				windowId: tab.windowId,
			});
			console.log("Side panel opened successfully");
		} catch (error) {
			console.error("Failed to open side panel:", error);
		}
	});
});
