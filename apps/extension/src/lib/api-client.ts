import { hc } from "hono/client";
import type { AppType } from "@quick-zaim/server-api";

export function createApiClient(serverUrl: string) {
  return hc<AppType>(serverUrl, {
    fetch: (input: RequestInfo | URL, init?: RequestInit) =>
      fetch(input, {
        ...init,
        credentials: "include",
        redirect: "manual",
      }),
  });
}

export type ApiClient = ReturnType<typeof createApiClient>;
