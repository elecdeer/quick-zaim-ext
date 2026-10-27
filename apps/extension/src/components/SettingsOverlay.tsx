import { Suspense, useEffect, useState } from "react";
import { browser } from "wxt/browser";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ErrorBoundary } from "@/lib/ErrorBoundary";
import { useSuspenseQuery } from "@/lib/query";
import { launchServerLogin } from "../auth/serverAuth.ts";
import { UNAUTHENTICATED } from "../entrypoints/sidepanel/authQueries.ts";
import {
  accountsQuery,
  authStatusQuery,
  categoriesQuery,
  placesQuery,
  serverUrlQuery,
} from "../queries.ts";
import ServerLogin from "./ServerLogin.tsx";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * サーバー URL 設定とサーバー認証をまとめて行う設定オーバーレイ。
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

  const refetchMasterQueries = async (): Promise<void> => {
    await Promise.all([
      categoriesQuery.refetch(serverUrl),
      accountsQuery.refetch(serverUrl),
      placesQuery.refetch(serverUrl),
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
      await refetchMasterQueries();
    } catch {
      // ユーザーがポップアップを閉じた場合など
    }
  };

  const handleServerLogout = () => {
    void browser.tabs.create({ url: `${serverUrl}/logout` });
    authStatusQuery.setData(serverUrl, UNAUTHENTICATED);
  };

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

      {storageError && (
        <p className="rounded-md bg-destructive/10 p-2 text-xs text-destructive">{storageError}</p>
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
              onLogin={handleServerLogin}
              onLogout={handleServerLogout}
              onRefresh={() => void refetchAuth()}
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
  onLogin: () => void;
  onLogout: () => void;
  onRefresh: () => void;
}

const AuthSection = ({
  serverUrl,
  isRefetching,
  onLogin,
  onLogout,
  onRefresh,
}: AuthSectionProps) => {
  const { data: auth } = useSuspenseQuery(authStatusQuery, serverUrl);

  return (
    <ServerLogin
      isAuthenticated={auth.isServerAuthenticated}
      user={auth.serverUser}
      isLoading={isRefetching}
      onLogin={onLogin}
      onLogout={onLogout}
      onRefresh={onRefresh}
    />
  );
};
