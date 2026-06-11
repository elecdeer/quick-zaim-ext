import { useEffect, useState } from "react";
import { Button, Dialog, Input } from "@cloudflare/kumo";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { browser } from "wxt/browser";
import { createClient } from "server/client";
import { launchServerLogin } from "../auth/serverAuth.ts";
import { launchZaimConnect } from "../auth/zaimAuth.ts";
import { UNAUTHENTICATED, fetchAuthStatus } from "../entrypoints/sidepanel/authQueries.ts";
import ServerLogin from "./ServerLogin.tsx";
import ZaimLogin from "./ZaimLogin.tsx";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * サーバー URL 設定、サーバー認証、Zaim 連携をまとめて行う設定オーバーレイ。
 */
export const SettingsOverlay = ({ open, onOpenChange }: Props) => {
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

  // 認証/連携完了時、未認証で失敗していた Zaim データ系クエリも再 fetch させる
  const invalidateZaimDataQueries = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["categories", serverUrl] }),
      queryClient.invalidateQueries({ queryKey: ["accounts", serverUrl] }),
      queryClient.invalidateQueries({ queryKey: ["stores", serverUrl] }),
    ]);

  const zaimConnectMutation = useMutation({
    mutationFn: () => launchZaimConnect(serverUrl),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["authStatus", serverUrl] });
      await invalidateZaimDataQueries();
    },
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

  const handleSaveServerUrl = async () => {
    const url = serverUrlInput.replace(/\/$/, "");
    try {
      await browser.storage.local.set({ serverUrl: url });
      queryClient.setQueryData(["serverUrl"], url);
      setStorageError(null);
    } catch {
      setStorageError("サーバー URL の保存に失敗しました");
    }
  };

  const handleServerLogin = async () => {
    try {
      await launchServerLogin(serverUrl);
      await queryClient.invalidateQueries({ queryKey: ["authStatus", serverUrl] });
      // Zaim 連携が既に済んでいるケースで Combobox の失敗状態を解消する
      await invalidateZaimDataQueries();
    } catch {
      // ユーザーがポップアップを閉じた場合など
    }
  };

  const handleServerLogout = () => {
    void browser.tabs.create({ url: `${serverUrl}/logout` });
    queryClient.setQueryData(["authStatus", serverUrl], UNAUTHENTICATED);
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog className="flex flex-col gap-4 p-6">
        <Dialog.Title className="text-base font-semibold text-gray-900">設定</Dialog.Title>

        <section className="flex items-end gap-2">
          <Input
            id="settings-server-url"
            label="サーバー URL"
            className="min-w-0 flex-1"
            type="url"
            value={serverUrlInput}
            onChange={(e) => setServerUrlInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSaveServerUrl()}
            placeholder="https://your-server.workers.dev"
          />
          <Button
            type="button"
            variant="primary"
            onClick={handleSaveServerUrl}
            disabled={!serverUrlInput || serverUrlInput === serverUrl}
          >
            保存
          </Button>
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
              onRefresh={() =>
                queryClient.invalidateQueries({ queryKey: ["authStatus", serverUrl] })
              }
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

        <div className="flex justify-end">
          <Dialog.Close
            render={(p) => (
              <Button {...p} type="button" variant="secondary">
                閉じる
              </Button>
            )}
          />
        </div>
      </Dialog>
    </Dialog.Root>
  );
};
