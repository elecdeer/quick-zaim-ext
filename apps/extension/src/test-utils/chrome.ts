type ChromeMockOptions = {
  serverUrl?: string;
};

export function setupChromeMock({ serverUrl = "http://mock-server.test" }: ChromeMockOptions = {}) {
  const storage: Record<string, unknown> = { serverUrl };

  window.chrome = {
    storage: {
      local: {
        get: (_keys: unknown, callback: (result: Record<string, unknown>) => void) => {
          callback(storage);
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
      getRedirectURL: () => "https://mock.chromiumapp.org/redirect",
      launchWebAuthFlow: () => Promise.resolve("https://mock.chromiumapp.org/redirect"),
    },
  } as unknown as typeof chrome;
}
