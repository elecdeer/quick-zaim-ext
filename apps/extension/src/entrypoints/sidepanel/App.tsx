import { GearIcon } from "@phosphor-icons/react";
import { Suspense, useEffect, useRef, useState } from "react";
import { SettingsOverlay } from "../../components/SettingsOverlay.tsx";
import { Button } from "@/components/ui/button";
import { ErrorBoundary } from "@/lib/ErrorBoundary";
import { useSuspenseQuery } from "@/lib/query";
import { authStatusQuery, serverUrlQuery } from "../../queries.ts";
import MainScreen from "./screens/MainScreen.tsx";

/**
 * アプリケーションのルートコンポーネント。
 */
export default function App() {
  return (
    <Suspense fallback={<AppShell />}>
      <AppContent />
    </Suspense>
  );
}

const AppShell = () => (
  <div className="flex min-h-screen flex-col gap-4 bg-background p-4">
    <header className="flex items-center justify-between">
      <h1 className="text-lg font-bold">Quick Zaim</h1>
    </header>
  </div>
);

const AppContent = () => {
  const { data: serverUrl } = useSuspenseQuery(serverUrlQuery, undefined);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const autoOpenedRef = useRef(false);

  if (!serverUrl) {
    return (
      <AppLayout settingsOpen={true} onSettingsOpenChange={() => {}}>
        <MainScreen serverUrl="" />
      </AppLayout>
    );
  }

  return (
    <ErrorBoundary
      fallback={
        <AppLayout settingsOpen={!autoOpenedRef.current} onSettingsOpenChange={() => {}}>
          <MainScreen serverUrl={serverUrl} />
        </AppLayout>
      }
    >
      <Suspense fallback={<AppShell />}>
        <AppWithAuth
          serverUrl={serverUrl}
          settingsOpen={settingsOpen}
          setSettingsOpen={setSettingsOpen}
          autoOpenedRef={autoOpenedRef}
        />
      </Suspense>
    </ErrorBoundary>
  );
};

interface AppWithAuthProps {
  serverUrl: string;
  settingsOpen: boolean;
  setSettingsOpen: (open: boolean) => void;
  autoOpenedRef: React.RefObject<boolean>;
}

const AppWithAuth = ({
  serverUrl,
  settingsOpen,
  setSettingsOpen,
  autoOpenedRef,
}: AppWithAuthProps) => {
  const { data: auth } = useSuspenseQuery(authStatusQuery, serverUrl);

  useEffect(() => {
    if (autoOpenedRef.current) return;
    if (!auth.isZaimConnected) {
      setSettingsOpen(true);
    }
    autoOpenedRef.current = true;
  }, [auth.isZaimConnected, setSettingsOpen, autoOpenedRef]);

  return (
    <AppLayout settingsOpen={settingsOpen} onSettingsOpenChange={setSettingsOpen}>
      <MainScreen serverUrl={serverUrl} />
    </AppLayout>
  );
};

interface AppLayoutProps {
  settingsOpen: boolean;
  onSettingsOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}

const AppLayout = ({ settingsOpen, onSettingsOpenChange, children }: AppLayoutProps) => (
  <div className="flex min-h-screen flex-col gap-4 bg-background p-4">
    <header className="flex items-center justify-between">
      <h1 className="text-lg font-bold">Quick Zaim</h1>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="設定"
        onClick={() => onSettingsOpenChange(true)}
      >
        <GearIcon size={20} weight="regular" />
      </Button>
    </header>
    {children}
    <SettingsOverlay open={settingsOpen} onOpenChange={onSettingsOpenChange} />
  </div>
);
