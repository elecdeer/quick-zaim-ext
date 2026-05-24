import ServerLogin from "../../../components/ServerLogin.tsx";
import ZaimLogin from "../../../components/ZaimLogin.tsx";

interface ServerUser {
  email?: string;
  sub?: string;
}

interface Props {
  serverUrl: string;
  serverUrlInput: string;
  isServerAuthenticated: boolean;
  serverUser: ServerUser | null;
  isZaimConnected: boolean;
  zaimUserId: string | null;
  isLoading: boolean;
  errorMessage: string | null;
  onServerUrlChange: (value: string) => void;
  onSaveServerUrl: () => void;
  onServerLogin: () => void;
  onServerLogout: () => void;
  onZaimConnect: () => void;
  onZaimDisconnect: () => void;
  onRefresh: () => void;
}

export default function UnauthedScreen({
  serverUrl,
  serverUrlInput,
  isServerAuthenticated,
  serverUser,
  isZaimConnected,
  zaimUserId,
  isLoading,
  errorMessage,
  onServerUrlChange,
  onSaveServerUrl,
  onServerLogin,
  onServerLogout,
  onZaimConnect,
  onZaimDisconnect,
  onRefresh,
}: Props) {
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
            onChange={(e) => onServerUrlChange(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onSaveServerUrl()}
            placeholder="https://your-server.workers.dev"
          />
          <button
            className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            type="button"
            onClick={onSaveServerUrl}
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
            isAuthenticated={isServerAuthenticated}
            user={serverUser}
            isLoading={isLoading}
            onLogin={onServerLogin}
            onLogout={onServerLogout}
            onRefresh={onRefresh}
          />

          {isServerAuthenticated && (
            <ZaimLogin
              isConnected={isZaimConnected}
              zaimUserId={zaimUserId}
              isLoading={isLoading}
              onConnect={onZaimConnect}
              onDisconnect={onZaimDisconnect}
              onRefresh={onRefresh}
            />
          )}
        </>
      )}
    </div>
  );
}
