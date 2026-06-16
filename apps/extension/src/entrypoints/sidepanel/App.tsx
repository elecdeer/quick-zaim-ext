import { GearIcon } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { browser } from "wxt/browser";
import { SettingsOverlay } from "../../components/SettingsOverlay.tsx";
import { Button } from "@/components/ui/button";
import { UNAUTHENTICATED, fetchAuthStatus } from "./authQueries.ts";
import MainScreen from "./screens/MainScreen.tsx";

export default function App() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const autoOpenedRef = useRef(false);

  const { data: serverUrl = "", isFetched: serverUrlFetched } = useQuery({
    queryKey: ["serverUrl"],
    queryFn: async () => {
      const result = await browser.storage.local.get("serverUrl");
      return (result.serverUrl as string) || "";
    },
  });

  const { data: auth = UNAUTHENTICATED, isFetched: authFetched } = useQuery({
    queryKey: ["authStatus", serverUrl],
    queryFn: () => fetchAuthStatus(serverUrl),
    enabled: !!serverUrl,
    retry: false,
  });

  // 初回起動時、未設定/未認証/Zaim未連携なら設定オーバーレイを自動オープンする。
  //
  // 両クエリが解決し終わるまで判定を保留する。`serverUrl` のデフォルト値（空文字）に
  // 引きずられて初回レンダリングで開いてしまうと、その後 auth が確定しても
  // autoOpenedRef のガードで閉じられず「ログイン済なのにダイアログが出たまま」になる。
  useEffect(() => {
    if (autoOpenedRef.current) return;
    if (!serverUrlFetched) return;
    if (serverUrl && !authFetched) return;

    if (!serverUrl || !auth.isZaimConnected) {
      setSettingsOpen(true);
    }
    autoOpenedRef.current = true;
  }, [serverUrl, serverUrlFetched, authFetched, auth.isZaimConnected]);

  return (
    <div className="flex min-h-screen flex-col gap-4 bg-background p-4">
      <header className="flex items-center justify-between">
        <h1 className="text-lg font-bold">Quick Zaim</h1>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="設定"
          onClick={() => setSettingsOpen(true)}
        >
          <GearIcon size={20} weight="regular" />
        </Button>
      </header>
      <MainScreen serverUrl={serverUrl} />
      <SettingsOverlay open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  );
}
