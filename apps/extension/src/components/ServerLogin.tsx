import { Badge, Button } from "@cloudflare/kumo";

interface ServerUser {
  email?: string;
  sub?: string;
}

interface Props {
  isAuthenticated: boolean;
  user: ServerUser | null;
  isLoading: boolean;
  onLogin: () => void;
  onLogout: () => void;
  onRefresh: () => void;
}

export default function ServerLogin({
  isAuthenticated,
  user,
  isLoading,
  onLogin,
  onLogout,
  onRefresh,
}: Props) {
  return (
    <section className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-700">サーバー認証</h2>
        <Badge variant={isAuthenticated ? "success" : "secondary"}>
          {isAuthenticated ? "ログイン済み" : "未ログイン"}
        </Badge>
      </div>

      {isAuthenticated && user?.email && <p className="text-sm text-gray-500">{user.email}</p>}

      <div className="flex gap-2">
        {isAuthenticated ? (
          <Button type="button" variant="secondary" onClick={onLogout} disabled={isLoading}>
            ログアウト
          </Button>
        ) : (
          <Button type="button" variant="primary" onClick={onLogin} disabled={isLoading}>
            ログイン
          </Button>
        )}
        <Button type="button" variant="ghost" onClick={onRefresh} disabled={isLoading}>
          更新
        </Button>
      </div>
    </section>
  );
}
