import { configureSync, getConsoleSink, getLogger } from "@logtape/logtape";

configureSync({
  sinks: {
    console: getConsoleSink(),
  },
  loggers: [
    {
      category: ["quick-zaim"],
      lowestLevel: "debug",
      sinks: ["console"],
    },
  ],
  reset: true,
});

export const authLogger = getLogger(["quick-zaim", "server", "auth"]);
export const zaimOAuthLogger = getLogger(["quick-zaim", "server", "zaim-oauth"]);
export const zaimRoutesLogger = getLogger(["quick-zaim", "server", "zaim-routes"]);
export const categoriesLogger = getLogger(["quick-zaim", "server", "categories"]);
export const accountsLogger = getLogger(["quick-zaim", "server", "accounts"]);
export const storesLogger = getLogger(["quick-zaim", "server", "stores"]);
export const paymentLogger = getLogger(["quick-zaim", "server", "payment"]);
