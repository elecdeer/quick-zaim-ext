import { GearIcon } from "@phosphor-icons/react";
import { Suspense, useEffect, useRef, useState } from "react";
import { SettingsOverlay } from "../../components/SettingsOverlay.tsx";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Toaster, ToastProvider } from "@/components/ui/toast";
import { ErrorBoundary } from "@/lib/ErrorBoundary";
import { useSuspenseQuery } from "@/lib/query";
import { authStatusQuery, serverUrlQuery } from "../../queries.ts";
import MainScreen from "./screens/MainScreen.tsx";
import StatementScreen from "./screens/StatementScreen.tsx";

/**
 * アプリケーションのルートコンポーネント。
 */
export default function App() {
  return (
    <ToastProvider>
      <Suspense fallback={<AppShell />}>
        <AppContent />
      </Suspense>
    </ToastProvider>
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
        <Screens serverUrl="" />
      </AppLayout>
    );
  }

  return (
    <ErrorBoundary
      fallback={
        <AppLayout settingsOpen={!autoOpenedRef.current} onSettingsOpenChange={() => {}}>
          <Screens serverUrl={serverUrl} />
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
    if (!auth.isServerAuthenticated) {
      setSettingsOpen(true);
    }
    autoOpenedRef.current = true;
  }, [auth.isServerAuthenticated, setSettingsOpen, autoOpenedRef]);

  return (
    <AppLayout settingsOpen={settingsOpen} onSettingsOpenChange={setSettingsOpen}>
      <Screens serverUrl={serverUrl} />
    </AppLayout>
  );
};

/**
 * 1 件ずつ登録する通常の画面と、明細から一括登録する画面をタブで切り替える。
 * 切り替えても入力中の内容が消えないよう、非表示のタブも mount したままにする。
 */
const Screens = ({ serverUrl }: { serverUrl: string }) => (
  <Tabs defaultValue="payment">
    <TabsList className="w-full">
      <TabsTrigger value="payment">支払い</TabsTrigger>
      <TabsTrigger value="statement">明細から一括</TabsTrigger>
    </TabsList>
    <TabsContent value="payment" keepMounted>
      <MainScreen serverUrl={serverUrl} />
    </TabsContent>
    <TabsContent value="statement" keepMounted>
      <StatementScreen serverUrl={serverUrl} />
    </TabsContent>
  </Tabs>
);

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
    <Toaster />
  </div>
);
