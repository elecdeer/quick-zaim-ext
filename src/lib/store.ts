import type { BaseStorage, StorageCallbackMap } from "@plasmohq/storage";
import { Storage } from "@plasmohq/storage";
import { useStorage } from "@plasmohq/storage/hook";
import { SecureStorage } from "@plasmohq/storage/secure";
import type { AccessTokenPair } from "./oauth";
import { getExtensionId } from "./runtime";
import { createLoadable } from "./suspenseUtil";

const storage = new Storage();
const secureStorage = new SecureStorage();

const waitSecureStorageReady = secureStorage.setPassword(getExtensionId());
const waitSecureStorageReadyLoadable = createLoadable(waitSecureStorageReady);

export type Store<T> = {
  get: () => Promise<T>;
  set: (value: T) => Promise<void>;
  remove: () => Promise<void>;
  hookAccessor: (
    suspense?: boolean
  ) => Exclude<Parameters<typeof useStorage>[0], string>;
  watch: (callback: (newValue: T, oldValue: T) => void) => () => void;
};

export const createStore = <T>(
  storage: BaseStorage,
  key: string,
  defaultValue: T
): Store<T> => {
  return {
    get: async (): Promise<T> => {
      await waitSecureStorageReady;
      const value = await storage.get<T>(key);
      console.log(key, value);
      if (value === undefined && defaultValue !== undefined) {
        console.log("set default value", key, defaultValue);
        await storage.set(key, defaultValue);
        return defaultValue;
      }
      return value;
    },
    set: async (value: T): Promise<void> => {
      await waitSecureStorageReady;
      await storage.set(key, value);
    },
    remove: async (): Promise<void> => {
      await waitSecureStorageReady;
      await storage.remove(key);
    },
    hookAccessor: (
      suspense = false
    ): Exclude<Parameters<typeof useStorage>[0], string> => {
      if (suspense) {
        waitSecureStorageReadyLoadable();
      }
      return {
        key,
        instance: storage,
      };
    },
    watch: (callback: (newValue: T, oldValue: T) => void): (() => void) => {
      const callbackMap: StorageCallbackMap = {
        [key]: (value) => callback(value.newValue, value.oldValue),
      };

      storage.watch(callbackMap);

      return () => {
        storage.unwatch(callbackMap);
      };
    },
  };
};

const keyPrefix = "quick-zaim-ext";

export const oauthConsumerKeyStore = createStore<string | undefined>(
  secureStorage,
  `${keyPrefix}-oauth-consumer-key`,
  undefined
);

export const oauthConsumerSecretStore = createStore<string | undefined>(
  secureStorage,
  `${keyPrefix}-oauth-consumer-secret`,
  undefined
);

export const oauthAccessTokenStore = createStore<AccessTokenPair | undefined>(
  secureStorage,
  `${keyPrefix}-oauth-access-token`,
  undefined
);

export const recentlyGenreStore = createStore<string[]>(
  storage,
  `${keyPrefix}-recently-select-genre`,
  []
);
