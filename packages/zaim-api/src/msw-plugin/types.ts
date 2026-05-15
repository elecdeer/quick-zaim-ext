import type { DefinePlugin } from "@hey-api/openapi-ts";

export type UserConfig = {
  name: "my-msw-plugin";
};

export type MyMswPlugin = DefinePlugin<UserConfig>;
