import { definePluginConfig } from "@hey-api/openapi-ts";

import { handler } from "./plugin";
import type { MyMswPlugin } from "./types";

export const defaultConfig: MyMswPlugin["Config"] = {
  config: {},
  dependencies: ["@hey-api/typescript"],
  handler,
  name: "msw",
};

export const defineConfig = definePluginConfig(defaultConfig);
