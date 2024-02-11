import type { BaseStorage, StorageCallbackMap } from "@plasmohq/storage";
import { Storage } from "@plasmohq/storage";
import { useStorage } from "@plasmohq/storage/hook";
import { SecureStorage } from "@plasmohq/storage/secure";
import { createStore as createJotaiStore } from "jotai";
import { atomWithStorage } from "jotai/utils";
import type {
  AsyncStorage,
  SyncStorage,
} from "jotai/vanilla/utils/atomWithStorage";
import type { AccessTokenPair } from "./oauth";
import { getExtensionId } from "./runtime";
import { createLoadable } from "./suspenseUtil";

export const jotaiStore = createJotaiStore();

export const extensionStorage = new Storage();
export const extensionSecureStorage = new SecureStorage();

const waitSecureStorageReady = extensionSecureStorage.setPassword(
  getExtensionId()
);
const waitSecureStorageReadyLoadable = createLoadable(waitSecureStorageReady);

export const createJotaiStorageAdapter = <T>(
  storage: BaseStorage
): AsyncStorage<T> => {
  return {
    getItem: async (key: string, initialValue: T) => {
      await waitSecureStorageReady;

      const value = await storage.get<T>(key);
      console.log("getItem", key, value);
      return value ?? initialValue;
    },
    setItem: async (key: string, newValue: T) => {
      await waitSecureStorageReady;
      await storage.set(key, newValue);
    },
    removeItem: async (key: string) => {
      await waitSecureStorageReady;
      await storage.remove(key);
    },
    subscribe: (key: string, callback: (value: T) => void, initialValue: T) => {
      const callbackMap: StorageCallbackMap = {
        [key]: (value) => callback(value.newValue ?? initialValue),
      };

      storage.watch(callbackMap);
      return () => {
        storage.unwatch(callbackMap);
      };
    },
  };
};

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
  const get = async (): Promise<T> => {
    await waitSecureStorageReady;
    const value = await storage.get<T>(key);
    // console.log(key, value);
    if (value === undefined && defaultValue !== undefined) {
      // console.log("set default value", key, defaultValue);
      await storage.set(key, defaultValue);
      return defaultValue;
    }
    return value;
  };

  const set = async (value: T): Promise<void> => {
    await waitSecureStorageReady;
    await storage.set(key, value);
  };

  const remove = async (): Promise<void> => {
    await waitSecureStorageReady;
    await storage.remove(key);
  };

  const hookAccessor = (
    suspense: boolean | undefined = false
  ): Exclude<Parameters<typeof useStorage>[0], string> => {
    if (suspense) {
      waitSecureStorageReadyLoadable();
    }
    return {
      key,
      instance: storage,
    };
  };

  const watch = (
    callback: (newValue: T, oldValue: T) => void
  ): (() => void) => {
    const callbackMap: StorageCallbackMap = {
      [key]: (value) => callback(value.newValue, value.oldValue),
    };

    storage.watch(callbackMap);

    return () => {
      storage.unwatch(callbackMap);
    };
  };

  return {
    get: get,
    set: set,
    remove: remove,
    hookAccessor: hookAccessor,
    watch: watch,
  };
};

const keyPrefix = "quick-zaim-ext";

export const oauthConsumerKeyStore = createStore<string | undefined>(
  extensionSecureStorage,
  `${keyPrefix}-oauth-consumer-key`,
  undefined
);

export const oauthConsumerSecretStore = createStore<string | undefined>(
  extensionSecureStorage,
  `${keyPrefix}-oauth-consumer-secret`,
  undefined
);

export const oauthAccessTokenStore = createStore<AccessTokenPair | undefined>(
  extensionSecureStorage,
  `${keyPrefix}-oauth-access-token`,
  undefined
);

export const recentlyGenreStore = createStore<string[]>(
  extensionStorage,
  `${keyPrefix}-recently-select-genre`,
  []
);

export const paymentPlacesStore = createStore<string[]>(
  extensionStorage,
  `${keyPrefix}-payment-places`,
  []
);
