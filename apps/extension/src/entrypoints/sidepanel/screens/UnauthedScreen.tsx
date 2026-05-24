import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { browser } from "wxt/browser";
import { createClient } from "server/client";
import { launchServerLogin } from "../../../auth/serverAuth.ts";
import { launchZaimConnect } from "../../../auth/zaimAuth.ts";
import ServerLogin from "../../../components/ServerLogin.tsx";
import ZaimLogin from "../../../components/ZaimLogin.tsx";
import { UNAUTHENTICATED, fetchAuthStatus } from "../authQueries.ts";

export default function UnauthedScreen() {
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
    <div className="flex flex-col gap-4">
      <p className="text-sm text-gray-500">
        Zaim に支払いを登録するには、サーバーの設定と Zaim 連携が必要です。
      </p>

      <section className="flex flex-col gap-2">
        <label className="text-xs font-semibold text-gray-500">サーバー URL</label>
        <div className="flex gap-2">
          <input
            className="min-w-0 flex-1 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            type="url"
            value={serverUrlInput}
            onChange={(e) => setServerUrlInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSaveServerUrl()}
            placeholder="https://your-server.workers.dev"
          />
          <button
            className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            type="button"
            onClick={handleSaveServerUrl}
            disabled={!serverUrlInput || serverUrlInput === serverUrl}
          >
            保存
          </button>
        </div>
      </section>

      {errorMessage && (
        <p className="rounded-md bg-red-50 p-2 text-xs text-red-600">{errorMessage}</p>
      )}

      {serverUrl && (
        <>
          <ServerLogin
            isAuthenticated={auth.isServerAuthenticated}
            user={auth.serverUser}
            isLoading={isLoading}
            onLogin={handleServerLogin}
            onLogout={handleServerLogout}
            onRefresh={() => queryClient.invalidateQueries({ queryKey: ["authStatus", serverUrl] })}
          />

          {auth.isServerAuthenticated && (
            <ZaimLogin
              isConnected={auth.isZaimConnected}
              zaimUserId={auth.zaimUserId}
              isLoading={isLoading}
              onConnect={() => zaimConnectMutation.mutate()}
              onDisconnect={() => zaimDisconnectMutation.mutate()}
              onRefresh={() =>
                queryClient.invalidateQueries({ queryKey: ["authStatus", serverUrl] })
              }
            />
          )}
        </>
      )}
    </div>
  );
}
