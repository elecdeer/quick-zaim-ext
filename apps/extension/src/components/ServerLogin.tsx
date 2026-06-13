import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

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
    <section className="flex flex-col gap-3 rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">サーバー認証</h2>
        <Badge variant={isAuthenticated ? "default" : "secondary"}>
          {isAuthenticated ? "ログイン済み" : "未ログイン"}
        </Badge>
      </div>

      {isAuthenticated && user?.email && (
        <p className="text-sm text-muted-foreground">{user.email}</p>
      )}

      <div className="flex gap-2">
        {isAuthenticated ? (
          <Button type="button" variant="secondary" onClick={onLogout} disabled={isLoading}>
            ログアウト
          </Button>
        ) : (
          <Button type="button" onClick={onLogin} disabled={isLoading}>
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
