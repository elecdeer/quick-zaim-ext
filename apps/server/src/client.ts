import { hc } from "hono/client";
import type { AppType } from "./index.ts";

export const createClient = (baseUrl: string, options?: Parameters<typeof hc>[1]) =>
  hc<AppType>(baseUrl, options);

export type { AppType };
