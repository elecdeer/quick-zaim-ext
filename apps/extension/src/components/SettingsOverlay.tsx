import { Suspense, useEffect, useState } from "react";
import { createClient } from "server/client";
import { browser } from "wxt/browser";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ErrorBoundary } from "@/lib/ErrorBoundary";
import { useSuspenseQuery } from "@/lib/query";
import { useMutation } from "@/lib/useMutation";
import { launchServerLogin } from "../auth/serverAuth.ts";
import { launchZaimConnect } from "../auth/zaimAuth.ts";
import { UNAUTHENTICATED } from "../entrypoints/sidepanel/authQueries.ts";
import {
  accountsQuery,
  authStatusQuery,
  categoriesQuery,
  serverUrlQuery,
  storesQuery,
} from "../queries.ts";
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
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex flex-col gap-4">
        <DialogTitle>設定</DialogTitle>
        <Suspense fallback={null}>
          <SettingsOverlayContent onOpenChange={onOpenChange} />
        </Suspense>
      </DialogContent>
    </Dialog>
  );
};

const SettingsOverlayContent = ({ onOpenChange: _onOpenChange }: Pick<Props, "onOpenChange">) => {
  const { data: serverUrl } = useSuspenseQuery(serverUrlQuery, undefined);
  const [serverUrlInput, setServerUrlInput] = useState("");
  const [storageError, setStorageError] = useState<string | null>(null);
  const [isRefetching, setIsRefetching] = useState(false);

  useEffect(() => {
    setServerUrlInput(serverUrl);
  }, [serverUrl]);

  const invalidateZaimDataQueries = async (): Promise<void> => {
    await Promise.all([
      categoriesQuery.refetch(serverUrl),
      accountsQuery.refetch(serverUrl),
      storesQuery.refetch(serverUrl),
    ]);
  };

  const refetchAuth = async (): Promise<void> => {
    setIsRefetching(true);
    try {
      await authStatusQuery.refetch(serverUrl);
    } finally {
      setIsRefetching(false);
    }
  };

  const zaimConnectMutation = useMutation({
    mutationFn: () => launchZaimConnect(serverUrl),
    onSuccess: async () => {
      await refetchAuth();
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
      authStatusQuery.setData(serverUrl, UNAUTHENTICATED);
    },
  });

  const handleSaveServerUrl = async () => {
    const url = serverUrlInput.replace(/\/$/, "");
    try {
      await browser.storage.local.set({ serverUrl: url });
      serverUrlQuery.setData(undefined, url);
      setStorageError(null);
    } catch {
      setStorageError("サーバー URL の保存に失敗しました");
    }
  };

  const handleServerLogin = async () => {
    try {
      await launchServerLogin(serverUrl);
      await refetchAuth();
      await invalidateZaimDataQueries();
    } catch {
      // ユーザーがポップアップを閉じた場合など
    }
  };

  const handleServerLogout = () => {
    void browser.tabs.create({ url: `${serverUrl}/logout` });
    authStatusQuery.setData(serverUrl, UNAUTHENTICATED);
  };

  const mutationError =
    (zaimConnectMutation.error instanceof Error ? zaimConnectMutation.error.message : null) ??
    (zaimDisconnectMutation.error instanceof Error ? zaimDisconnectMutation.error.message : null);

  const errorMessage = storageError ?? mutationError;

  return (
    <>
      <section className="flex items-end gap-2">
        <Field className="min-w-0 flex-1">
          <FieldLabel htmlFor="settings-server-url">サーバー URL</FieldLabel>
          <Input
            id="settings-server-url"
            type="url"
            value={serverUrlInput}
            onChange={(e) => setServerUrlInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSaveServerUrl()}
            placeholder="https://your-server.workers.dev"
          />
        </Field>
        <Button
          type="button"
          onClick={handleSaveServerUrl}
          disabled={!serverUrlInput || serverUrlInput === serverUrl}
        >
          保存
        </Button>
      </section>

      {errorMessage && (
        <p className="rounded-md bg-destructive/10 p-2 text-xs text-destructive">{errorMessage}</p>
      )}

      {serverUrl && (
        <ErrorBoundary
          fallback={(error) => (
            <p className="rounded-md bg-destructive/10 p-2 text-xs text-destructive">
              {error.message}
            </p>
          )}
        >
          <Suspense fallback={null}>
            <AuthSection
              serverUrl={serverUrl}
              isRefetching={isRefetching}
              zaimConnectPending={zaimConnectMutation.isPending}
              zaimDisconnectPending={zaimDisconnectMutation.isPending}
              onLogin={handleServerLogin}
              onLogout={handleServerLogout}
              onRefresh={() => void refetchAuth()}
              onZaimConnect={() => zaimConnectMutation.mutate()}
              onZaimDisconnect={() => zaimDisconnectMutation.mutate()}
            />
          </Suspense>
        </ErrorBoundary>
      )}

      <div className="flex justify-end">
        <DialogClose
          render={
            <Button type="button" variant="secondary">
              閉じる
            </Button>
          }
        />
      </div>
    </>
  );
};

interface AuthSectionProps {
  serverUrl: string;
  isRefetching: boolean;
  zaimConnectPending: boolean;
  zaimDisconnectPending: boolean;
  onLogin: () => void;
  onLogout: () => void;
  onRefresh: () => void;
  onZaimConnect: () => void;
  onZaimDisconnect: () => void;
}

const AuthSection = ({
  serverUrl,
  isRefetching,
  zaimConnectPending,
  zaimDisconnectPending,
  onLogin,
  onLogout,
  onRefresh,
  onZaimConnect,
  onZaimDisconnect,
}: AuthSectionProps) => {
  const { data: auth } = useSuspenseQuery(authStatusQuery, serverUrl);
  const isLoading = isRefetching || zaimConnectPending || zaimDisconnectPending;

  return (
    <>
      <ServerLogin
        isAuthenticated={auth.isServerAuthenticated}
        user={auth.serverUser}
        isLoading={isLoading}
        onLogin={onLogin}
        onLogout={onLogout}
        onRefresh={onRefresh}
      />

      {auth.isServerAuthenticated && (
        <ZaimLogin
          isConnected={auth.isZaimConnected}
          zaimUserId={auth.zaimUserId}
          isLoading={isLoading}
          onConnect={onZaimConnect}
          onDisconnect={onZaimDisconnect}
          onRefresh={onRefresh}
        />
      )}
    </>
  );
};
