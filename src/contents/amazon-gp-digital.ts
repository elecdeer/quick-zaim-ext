import type { PlasmoCSConfig } from "plasmo";
import { addMessageListener } from "~lib/runtime";
import { extractDigitalOrder } from "~lib/service/extract/amazon/extractDigitalOrder";

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
