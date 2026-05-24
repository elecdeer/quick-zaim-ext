import { configureSync, getConsoleSink } from "@logtape/logtape";

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
