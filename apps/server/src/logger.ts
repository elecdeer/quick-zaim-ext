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

export const serverLogger = getLogger(["quick-zaim", "server"]);
export const authLogger = getLogger(["quick-zaim", "server", "auth"]);
