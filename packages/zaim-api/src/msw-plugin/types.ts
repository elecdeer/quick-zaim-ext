import type { DefinePlugin } from "@hey-api/openapi-ts";

export type UserConfig = {
  name: "my-msw-plugin";
  /**
   * 全ハンドラーをまとめる関数名
   * @default 'getZaimApiMock'
   */
  bundleFunctionName?: string;
};

export type MyMswPlugin = DefinePlugin<UserConfig>;
