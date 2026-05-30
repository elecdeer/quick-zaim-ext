import { useQuery } from "@tanstack/react-query";
import { browser } from "wxt/browser";
import { UNAUTHENTICATED, fetchAuthStatus } from "./authQueries.ts";
import UnauthedScreen from "./screens/UnauthedScreen.tsx";
import MainScreen from "./screens/MainScreen.tsx";

export default function App() {
  const { data: serverUrl = "" } = useQuery({
    queryKey: ["serverUrl"],
    queryFn: async () => {
      const result = await browser.storage.local.get("serverUrl");
      return (result.serverUrl as string) || "";
    },
  });

  const { data: auth = UNAUTHENTICATED } = useQuery({
    queryKey: ["authStatus", serverUrl],
    queryFn: () => fetchAuthStatus(serverUrl),
    enabled: !!serverUrl,
    retry: false,
  });

  return (
    <div className="flex min-h-screen flex-col gap-4 bg-gray-50 p-4">
      <h1 className="text-lg font-bold text-gray-900">Quick Zaim</h1>
      {auth.isZaimConnected ? <MainScreen /> : <UnauthedScreen />}
    </div>
  );
}
