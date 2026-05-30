import { createClient } from "server/client";

export interface ServerUser {
  email?: string;
  sub?: string;
}

export interface AuthStatus {
  isServerAuthenticated: boolean;
  serverUser: ServerUser | null;
  isZaimConnected: boolean;
  zaimUserId: string | null;
}

export const UNAUTHENTICATED: AuthStatus = {
  isServerAuthenticated: false,
  serverUser: null,
  isZaimConnected: false,
  zaimUserId: null,
};

export const fetchAuthStatus = async (url: string): Promise<AuthStatus> => {
  const client = createClient(url);
  let meRes: Response;
  try {
    meRes = await client.me.$get({}, { init: { credentials: "include", redirect: "manual" } });
  } catch {
    throw new Error("サーバーへの接続に失敗しました");
  }

  if (meRes.type === "opaqueredirect" || !meRes.ok) {
    return UNAUTHENTICATED;
  }

  const user = await meRes.json();
  let zaim: { connected: boolean; zaimUserId?: string };
  try {
    const zaimRes = await client.zaim.auth.status.$get(
      {},
      { init: { credentials: "include", redirect: "manual" } },
    );
    zaim =
      zaimRes.ok && zaimRes.type !== "opaqueredirect"
        ? await zaimRes.json()
        : { connected: false as const };
  } catch {
    zaim = { connected: false as const };
  }

  return {
    isServerAuthenticated: true,
    serverUser: user as ServerUser,
    isZaimConnected: zaim.connected,
    zaimUserId: "zaimUserId" in zaim ? (zaim.zaimUserId as string) : null,
  };
};
