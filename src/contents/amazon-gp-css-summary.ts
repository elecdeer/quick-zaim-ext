import type { PlasmoCSConfig } from "plasmo";
import { addMessageListener } from "~lib/runtime";
import { extractDeliveryOrder } from "~lib/service/extract/amazon/extractDeliveryOrder";

export const config: PlasmoCSConfig = {
  matches: ["https://www.amazon.co.jp/gp/css/summary/print.html/*"],
};

addMessageListener((message, _, sendResponse) => {
  if (message.name !== "extract") return;

  const extractedOrder = extractDeliveryOrder(window.document);
  sendResponse(extractedOrder);
});
