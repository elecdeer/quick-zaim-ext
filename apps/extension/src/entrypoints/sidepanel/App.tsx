import { useEffect, useRef, useState } from "react";
import { Button } from "@cloudflare/kumo";
import { GearIcon } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { browser } from "wxt/browser";
import { SettingsOverlay } from "../../components/SettingsOverlay.tsx";
import { UNAUTHENTICATED, fetchAuthStatus } from "./authQueries.ts";
import MainScreen from "./screens/MainScreen.tsx";

export default function App() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const autoOpenedRef = useRef(false);

  const { data: serverUrl = "" } = useQuery({
    queryKey: ["serverUrl"],
    queryFn: async () => {
      const result = await browser.storage.local.get("serverUrl");
      return (result.serverUrl as string) || "";
    },
  });

  const { data: auth = UNAUTHENTICATED, isFetched } = useQuery({
    queryKey: ["authStatus", serverUrl],
    queryFn: () => fetchAuthStatus(serverUrl),
    enabled: !!serverUrl,
    retry: false,
  });

  // 初回起動時、未設定/未認証/Zaim未連携なら設定オーバーレイを自動オープン
  useEffect(() => {
    if (autoOpenedRef.current) return;
    const needsSetup = !serverUrl || (isFetched && !auth.isZaimConnected);
    if (needsSetup) {
      setSettingsOpen(true);
      autoOpenedRef.current = true;
    }
  }, [serverUrl, isFetched, auth.isZaimConnected]);

  return (
    <div className="flex min-h-screen flex-col gap-4 bg-gray-50 p-4">
      <header className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-gray-900">Quick Zaim</h1>
        <Button
          type="button"
          variant="ghost"
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
