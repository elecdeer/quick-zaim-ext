import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { browser } from "wxt/browser";
import { createClient } from "server/client";
import { launchServerLogin } from "../../auth/serverAuth.ts";
import { launchZaimConnect } from "../../auth/zaimAuth.ts";
import UnauthedScreen from "./screens/UnauthedScreen.tsx";
import MainScreen from "./screens/MainScreen.tsx";

interface ServerUser {
  email?: string;
  sub?: string;
}

interface AuthStatus {
  isServerAuthenticated: boolean;
  serverUser: ServerUser | null;
  isZaimConnected: boolean;
  zaimUserId: string | null;
}

const UNAUTHENTICATED: AuthStatus = {
  isServerAuthenticated: false,
  serverUser: null,
  isZaimConnected: false,
  zaimUserId: null,
};

async function fetchAuthStatus(url: string): Promise<AuthStatus> {
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
}

export default function App() {
  const queryClient = useQueryClient();
  const [serverUrlInput, setServerUrlInput] = useState("");
  const [storageError, setStorageError] = useState<string | null>(null);

  const { data: serverUrl = "" } = useQuery({
    queryKey: ["serverUrl"],
    queryFn: async () => {
      const result = await browser.storage.local.get("serverUrl");
      return (result.serverUrl as string) || "";
    },
  });

  useEffect(() => {
    setServerUrlInput(serverUrl);
  }, [serverUrl]);

  const {
    data: auth = UNAUTHENTICATED,
    isFetching: authFetching,
    error: authError,
  } = useQuery({
    queryKey: ["authStatus", serverUrl],
    queryFn: () => fetchAuthStatus(serverUrl),
    enabled: !!serverUrl,
    retry: false,
  });

  const zaimConnectMutation = useMutation({
    mutationFn: () => launchZaimConnect(serverUrl),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["authStatus", serverUrl] }),
  });

  const zaimDisconnectMutation = useMutation({
    mutationFn: async () => {
      const client = createClient(serverUrl);
      const res = await client.zaim.auth.token.$delete(
        {},
        { init: { credentials: "include", redirect: "manual" } },
      );
      if (!res.ok || res.type === "opaqueredirect") {
        throw new Error("Zaim 連携解除に失敗しました");
      }
    },
    onSuccess: () => {
      queryClient.setQueryData(["authStatus", serverUrl], UNAUTHENTICATED);
    },
  });

  const isLoading =
    authFetching || zaimConnectMutation.isPending || zaimDisconnectMutation.isPending;

  const errorMessage =
    storageError ??
    (authError instanceof Error ? authError.message : null) ??
    (zaimConnectMutation.error instanceof Error ? zaimConnectMutation.error.message : null) ??
    (zaimDisconnectMutation.error instanceof Error ? zaimDisconnectMutation.error.message : null);

  async function handleSaveServerUrl() {
    const url = serverUrlInput.replace(/\/$/, "");
    try {
      await browser.storage.local.set({ serverUrl: url });
      queryClient.setQueryData(["serverUrl"], url);
      setStorageError(null);
    } catch {
      setStorageError("サーバー URL の保存に失敗しました");
    }
  }

  async function handleServerLogin() {
    try {
      await launchServerLogin(serverUrl);
      await queryClient.invalidateQueries({ queryKey: ["authStatus", serverUrl] });
    } catch {
      // ユーザーがポップアップを閉じた場合など
    }
  }

  function handleServerLogout() {
    void browser.tabs.create({ url: `${serverUrl}/logout` });
    queryClient.setQueryData(["authStatus", serverUrl], UNAUTHENTICATED);
  }

  return (
    <div className="flex min-h-screen flex-col gap-4 bg-gray-50 p-4">
      <h1 className="text-lg font-bold text-gray-900">Quick Zaim</h1>

      {auth.isZaimConnected ? (
        <MainScreen />
      ) : (
        <UnauthedScreen
          serverUrl={serverUrl}
          serverUrlInput={serverUrlInput}
          isServerAuthenticated={auth.isServerAuthenticated}
          serverUser={auth.serverUser}
          isZaimConnected={auth.isZaimConnected}
          zaimUserId={auth.zaimUserId}
          isLoading={isLoading}
          errorMessage={errorMessage}
          onServerUrlChange={setServerUrlInput}
          onSaveServerUrl={handleSaveServerUrl}
          onServerLogin={handleServerLogin}
          onServerLogout={handleServerLogout}
          onZaimConnect={() => zaimConnectMutation.mutate()}
          onZaimDisconnect={() => zaimDisconnectMutation.mutate()}
          onRefresh={() => queryClient.invalidateQueries({ queryKey: ["authStatus", serverUrl] })}
        />
      )}
    </div>
  );
}
