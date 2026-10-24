import { createServerClient } from "../../lib/serverClient";

export interface ServerUser {
  email?: string;
  id?: string;
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
  const client = createServerClient(url);
  let meRes: Response;
  try {
    meRes = await client.me.$get({});
  } catch {
    throw new Error("サーバーへの接続に失敗しました");
  }

  if (!meRes.ok) {
    return UNAUTHENTICATED;
  }

  const user = await meRes.json();
  let zaim: { connected: boolean; zaimUserId?: string };
  try {
    const zaimRes = await client.zaim.auth.status.$get({});
    zaim = zaimRes.ok ? await zaimRes.json() : { connected: false as const };
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
