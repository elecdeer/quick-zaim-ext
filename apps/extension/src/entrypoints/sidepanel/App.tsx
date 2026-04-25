import { useCallback, useEffect, useState } from "react";
import { createClient } from "server/client";
import ServerLogin from "../../components/ServerLogin.tsx";
import ZaimLogin from "../../components/ZaimLogin.tsx";

interface ServerUser {
  email?: string;
  sub?: string;
}

interface AuthState {
  isServerAuthenticated: boolean;
  serverUser: ServerUser | null;
  isZaimConnected: boolean;
  zaimUserId: string | null;
  isLoading: boolean;
  error: string | null;
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

const DEFAULT_STATE: AuthState = {
  isServerAuthenticated: false,
  serverUser: null,
  isZaimConnected: false,
  zaimUserId: null,
  isLoading: false,
  error: null,
};

export default function App() {
  const [serverUrl, setServerUrl] = useState("");
  const [serverUrlInput, setServerUrlInput] = useState("");
  const [auth, setAuth] = useState<AuthState>(DEFAULT_STATE);
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoriesFetchedAt, setCategoriesFetchedAt] = useState<string | null>(null);
  const [categoriesLoading, setCategoriesLoading] = useState(false);

  const fetchCategories = useCallback(async (url: string) => {
    setCategoriesLoading(true);
    try {
      const res = await fetch(`${url}/api/zaim/categories`, {
        credentials: "include",
        redirect: "manual",
      });
      if (res.ok && res.type !== "opaqueredirect") {
        const data = (await res.json()) as { fetchedAt: string; categories: Category[] };
        setCategories(data.categories);
        setCategoriesFetchedAt(data.fetchedAt);
      }
    } finally {
      setCategoriesLoading(false);
    }
  }, []);

  const checkAuthStatus = useCallback(
    async (url: string) => {
      if (!url) return;
      setAuth((prev) => ({ ...prev, isLoading: true, error: null }));

      const client = createClient(url);

      let meRes: Response;
      try {
        // redirect: "manual" でOIDCリダイレクト(302)をエラーなく検知する
        meRes = await client.me.$get({}, { init: { credentials: "include", redirect: "manual" } });
      } catch {
        // ネットワークエラー（サーバー未起動・URLが不正など）
        setAuth({
          ...DEFAULT_STATE,
          isLoading: false,
          error: "サーバーへの接続に失敗しました",
        });
        return;
      }

      // opaqueredirect = 未認証でOIDCにリダイレクトされた状態
      if (meRes.type === "opaqueredirect" || !meRes.ok) {
        setAuth({ ...DEFAULT_STATE, isLoading: false });
        setCategories([]);
        setCategoriesFetchedAt(null);
        return;
      }

      try {
        const user = await meRes.json();

        const zaimRes = await client.zaim.auth.status.$get(
          {},
          { init: { credentials: "include", redirect: "manual" } },
        );
        const zaim =
          zaimRes.ok && zaimRes.type !== "opaqueredirect"
            ? await zaimRes.json()
            : { connected: false as const };

        const isConnected = zaim.connected;

        setAuth({
          isServerAuthenticated: true,
          serverUser: user,
          isZaimConnected: isConnected,
          zaimUserId: "zaimUserId" in zaim ? zaim.zaimUserId : null,
          isLoading: false,
          error: null,
        });

        if (isConnected) {
          void fetchCategories(url);
        } else {
          setCategories([]);
          setCategoriesFetchedAt(null);
        }
      } catch {
        setAuth({ ...DEFAULT_STATE, isLoading: false, error: "レスポンスの解析に失敗しました" });
      }
    },
    [fetchCategories],
  );

  useEffect(() => {
    chrome.storage.local.get("serverUrl", (result) => {
      const url = (result.serverUrl as string) || "";
      setServerUrl(url);
      setServerUrlInput(url);
      if (url) void checkAuthStatus(url);
    });
  }, [checkAuthStatus]);

  function handleSaveServerUrl() {
    const url = serverUrlInput.replace(/\/$/, "");
    chrome.storage.local.set({ serverUrl: url }, () => {
      setServerUrl(url);
      void checkAuthStatus(url);
    });
  }

  function handleServerLogin() {
    // /me はOIDC保護されているため、未認証時はAuth0にリダイレクトされてログインフローが始まる
    void chrome.tabs.create({ url: `${serverUrl}/me` });
  }

  function handleServerLogout() {
    void chrome.tabs.create({ url: `${serverUrl}/logout` });
    setAuth(DEFAULT_STATE);
    setCategories([]);
    setCategoriesFetchedAt(null);
  }

  function handleZaimConnect() {
    void chrome.tabs.create({ url: `${serverUrl}/zaim/auth/start` });
  }

  async function handleZaimDisconnect() {
    setAuth((prev) => ({ ...prev, isLoading: true }));
    const client = createClient(serverUrl);
    try {
      await client.zaim.auth.token.$delete({}, { init: { credentials: "include" } });
      setAuth((prev) => ({
        ...prev,
        isZaimConnected: false,
        zaimUserId: null,
        isLoading: false,
      }));
      setCategories([]);
      setCategoriesFetchedAt(null);
    } catch {
      setAuth((prev) => ({ ...prev, isLoading: false }));
    }
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

      {auth.error && <p className="rounded-md bg-red-50 p-2 text-xs text-red-600">{auth.error}</p>}

      {serverUrl && (
        <>
          <ServerLogin
            isAuthenticated={auth.isServerAuthenticated}
            user={auth.serverUser}
            isLoading={auth.isLoading}
            onLogin={handleServerLogin}
            onLogout={handleServerLogout}
            onRefresh={() => checkAuthStatus(serverUrl)}
          />

          {auth.isServerAuthenticated && (
            <ZaimLogin
              isConnected={auth.isZaimConnected}
              zaimUserId={auth.zaimUserId}
              isLoading={auth.isLoading}
              onConnect={handleZaimConnect}
              onDisconnect={handleZaimDisconnect}
              onRefresh={() => checkAuthStatus(serverUrl)}
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
              {categoriesLoading ? (
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
