import { useCallback, useEffect, useState } from "react";
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

  const checkAuthStatus = useCallback(async (url: string) => {
    if (!url) return;
    setAuth((prev) => ({ ...prev, isLoading: true, error: null }));

    let meRes: Response;
    try {
      // redirect: "manual" でOIDCリダイレクト(302)をエラーなく検知する
      meRes = await fetch(`${url}/me`, {
        credentials: "include",
        redirect: "manual",
      });
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
      return;
    }

    try {
      const user: ServerUser = await meRes.json();

      const zaimRes = await fetch(`${url}/zaim/auth/status`, {
        credentials: "include",
        redirect: "manual",
      });
      const zaim =
        zaimRes.ok && zaimRes.type !== "opaqueredirect"
          ? await zaimRes.json()
          : { connected: false, zaimUserId: null };

      setAuth({
        isServerAuthenticated: true,
        serverUser: user,
        isZaimConnected: zaim.connected ?? false,
        zaimUserId: zaim.zaimUserId ?? null,
        isLoading: false,
        error: null,
      });
    } catch {
      setAuth({ ...DEFAULT_STATE, isLoading: false, error: "レスポンスの解析に失敗しました" });
    }
  }, []);

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
  }

  function handleZaimConnect() {
    void chrome.tabs.create({ url: `${serverUrl}/zaim/auth/start` });
  }

  async function handleZaimDisconnect() {
    setAuth((prev) => ({ ...prev, isLoading: true }));
    try {
      await fetch(`${serverUrl}/zaim/auth/token`, {
        method: "DELETE",
        credentials: "include",
      });
      setAuth((prev) => ({
        ...prev,
        isZaimConnected: false,
        zaimUserId: null,
        isLoading: false,
      }));
    } catch {
      setAuth((prev) => ({ ...prev, isLoading: false }));
    }
  }

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
        </>
      )}
    </div>
  );
}
