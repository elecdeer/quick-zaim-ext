import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { browser } from "wxt/browser";
import { createClient } from "server/client";
import { launchServerLogin } from "../../auth/serverAuth.ts";
import { launchZaimConnect } from "../../auth/zaimAuth.ts";
import ServerLogin from "../../components/ServerLogin.tsx";
import ZaimLogin from "../../components/ZaimLogin.tsx";

interface ServerUser {
  email?: string;
  sub?: string;
}

interface SubCategory {
  id: number;
  name: string;
}

interface Category {
  id: number;
  name: string;
  mode: "payment" | "income";
  subCategories: SubCategory[];
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

async function fetchCategoriesData(url: string) {
  const client = createClient(url);
  const res = await client.api.zaim.categories.$get(
    { query: {} },
    { init: { credentials: "include", redirect: "manual" } },
  );
  if (res.ok && res.type !== "opaqueredirect") {
    return res.json() as Promise<{ fetchedAt: string; categories: Category[] }>;
  }
  throw new Error("カテゴリの取得に失敗しました");
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

  const {
    data: categoriesData,
    isFetching: categoriesFetching,
    error: categoriesError,
  } = useQuery({
    queryKey: ["categories", serverUrl],
    queryFn: () => fetchCategoriesData(serverUrl),
    enabled: !!serverUrl && auth.isZaimConnected,
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
      queryClient.removeQueries({ queryKey: ["categories", serverUrl] });
    },
  });

  const categories = categoriesData?.categories ?? [];
  const categoriesFetchedAt = categoriesData?.fetchedAt ?? null;
  const isLoading =
    authFetching || zaimConnectMutation.isPending || zaimDisconnectMutation.isPending;
  const errorMessage =
    storageError ??
    (authError instanceof Error ? authError.message : null) ??
    (zaimConnectMutation.error instanceof Error ? zaimConnectMutation.error.message : null) ??
    (zaimDisconnectMutation.error instanceof Error ? zaimDisconnectMutation.error.message : null) ??
    (categoriesError instanceof Error ? categoriesError.message : null);

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
    queryClient.removeQueries({ queryKey: ["categories", serverUrl] });
  }

  const paymentCategories = categories.filter((c) => c.mode === "payment");

  return (
    <div className="flex min-h-screen flex-col gap-4 bg-gray-50 p-4">
      <h1 className="text-lg font-bold text-gray-900">Quick Zaim</h1>

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

          {auth.isZaimConnected && (
            <section className="flex flex-col gap-2">
              <div className="flex items-baseline gap-2">
                <label className="text-xs font-semibold text-gray-500">カテゴリ</label>
                {categoriesFetchedAt && (
                  <span className="text-xs text-gray-400">
                    {new Date(categoriesFetchedAt).toLocaleString("ja-JP")} 取得
                  </span>
                )}
              </div>
              {categoriesFetching ? (
                <p className="text-xs text-gray-400">読み込み中...</p>
              ) : paymentCategories.length === 0 ? (
                <p className="text-xs text-gray-400">カテゴリがありません</p>
              ) : (
                <ul className="flex flex-col gap-1">
                  {paymentCategories.map((cat) => (
                    <li key={cat.id} className="rounded-md bg-white px-3 py-2 text-sm shadow-sm">
                      <span className="font-medium text-gray-800">{cat.name}</span>
                      {cat.subCategories.length > 0 && (
                        <ul className="mt-1 flex flex-wrap gap-1">
                          {cat.subCategories.map((sub) => (
                            <li
                              key={sub.id}
                              className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600"
                            >
                              {sub.name}
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}
