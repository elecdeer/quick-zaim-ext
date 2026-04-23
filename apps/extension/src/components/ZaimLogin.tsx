import { Badge, Button } from "@cloudflare/kumo";

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
    <section className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-700">Zaim 連携</h2>
        <Badge variant={isConnected ? "success" : "secondary"}>
          {isConnected ? "連携済み" : "未連携"}
        </Badge>
      </div>

      {isConnected && zaimUserId && (
        <p className="text-sm text-gray-500">ユーザーID: {zaimUserId}</p>
      )}

      <div className="flex gap-2">
        {isConnected ? (
          <Button
            type="button"
            variant="secondary-destructive"
            onClick={onDisconnect}
            disabled={isLoading}
          >
            連携解除
          </Button>
        ) : (
          <Button type="button" variant="primary" onClick={onConnect} disabled={isLoading}>
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
