import type { DefinePlugin } from "@hey-api/openapi-ts";

export type UserConfig = {
  name: "msw";
};

export type MyMswPlugin = DefinePlugin<UserConfig>;
