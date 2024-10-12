import type { PlasmoCSConfig } from "plasmo";
import { extractDigitalOrder } from "~features/extract/pages/amazon/extractDigitalOrder";
import { addMessageListener } from "~lib/runtime";

export const config: PlasmoCSConfig = {
	matches: [
		"https://www.amazon.co.jp/gp/digital/your-account/order-summary.html/*",
	],
};

addMessageListener((message, _, sendResponse) => {
	if (message.name !== "extract") return;

	const extractedOrder = extractDigitalOrder(window.document);
	sendResponse(extractedOrder);
});

console.log("amazon-gp-digital.ts loaded");
