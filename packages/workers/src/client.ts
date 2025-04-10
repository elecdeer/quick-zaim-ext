import { hc } from "hono/client";
import type { AppType as _AppType } from "./index";

// index.ts からインポートした型を AppType として再エクスポート
// これにより、クライアント側はこのファイルから AppType をインポートできる
export type AppType = _AppType;

// RPC クライアントを生成する関数をエクスポート
export const createApiClient = (baseUrl: string) => {
	return hc<AppType>(baseUrl);
};

const c = hc<AppType>("baseUrl");
