type ChromeMockOptions = {
  serverUrl?: string;
};

export function setupChromeMock({ serverUrl = "http://mock-server.test" }: ChromeMockOptions = {}) {
  const storage: Record<string, unknown> = { serverUrl };

  window.chrome = {
    storage: {
      local: {
        get: (keys: unknown, callback: (result: Record<string, unknown>) => void) => {
          if (keys == null) {
            callback({ ...storage });
            return;
          }
          if (typeof keys === "string") {
            callback({ [keys]: storage[keys] });
            return;
          }
          if (Array.isArray(keys)) {
            callback(Object.fromEntries(keys.map((k) => [String(k), storage[String(k)]])));
            return;
          }
          if (typeof keys === "object") {
            const defaults = keys as Record<string, unknown>;
            callback(
              Object.fromEntries(Object.keys(defaults).map((k) => [k, storage[k] ?? defaults[k]])),
            );
            return;
          }
          callback({});
        },
        set: (data: Record<string, unknown>, callback?: () => void) => {
          Object.assign(storage, data);
          callback?.();
        },
      },
    },
    tabs: {
      create: () => Promise.resolve({} as chrome.tabs.Tab),
    },
    identity: {
      getRedirectURL: (path?: string) => `https://mock.chromiumapp.org/${path ?? "redirect"}`,
      launchWebAuthFlow: () => Promise.resolve("https://mock.chromiumapp.org/redirect"),
    },
  } as unknown as typeof chrome;
}
