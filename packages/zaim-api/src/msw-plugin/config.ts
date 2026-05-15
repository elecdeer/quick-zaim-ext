import { definePluginConfig } from "@hey-api/openapi-ts";

import { handler } from "./plugin";
import type { MyMswPlugin } from "./types";

export const defaultConfig: MyMswPlugin["Config"] = {
  config: {},
  dependencies: ["@hey-api/typescript"],
  handler,
  name: "my-msw-plugin",
};

export const defineConfig = definePluginConfig(defaultConfig);
