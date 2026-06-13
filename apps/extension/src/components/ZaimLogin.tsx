import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface Props {
  isConnected: boolean;
  zaimUserId: string | null;
  isLoading: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
  onRefresh: () => void;
}

export default function ZaimLogin({
  isConnected,
  zaimUserId,
  isLoading,
  onConnect,
  onDisconnect,
  onRefresh,
}: Props) {
  return (
    <section className="flex flex-col gap-3 rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Zaim 連携</h2>
        <Badge variant={isConnected ? "default" : "secondary"}>
          {isConnected ? "連携済み" : "未連携"}
        </Badge>
      </div>

      {isConnected && zaimUserId && (
        <p className="text-sm text-muted-foreground">ユーザーID: {zaimUserId}</p>
      )}

      <div className="flex gap-2">
        {isConnected ? (
          <Button type="button" variant="destructive" onClick={onDisconnect} disabled={isLoading}>
            連携解除
          </Button>
        ) : (
          <Button type="button" onClick={onConnect} disabled={isLoading}>
            Zaim でログイン
          </Button>
        )}
        <Button type="button" variant="ghost" onClick={onRefresh} disabled={isLoading}>
          更新
        </Button>
      </div>
    </section>
  );
}
