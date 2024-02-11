import type { PlasmoCSConfig } from "plasmo";
import { extractDeliveryOrder } from "~features/extract/pages/amazon/extractDeliveryOrder";
import { addMessageListener } from "~lib/runtime";

export const config: PlasmoCSConfig = {
	matches: ["https://www.amazon.co.jp/gp/css/summary/print.html*"],
};

addMessageListener((message, _, sendResponse) => {
	if (message.name !== "extract") return;

	const extractedOrder = extractDeliveryOrder(window.document);
	sendResponse(extractedOrder);
});
