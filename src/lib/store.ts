import type { BaseStorage, StorageCallbackMap } from "@plasmohq/storage";
import { useStorage } from "@plasmohq/storage/hook";
import { SecureStorage } from "@plasmohq/storage/secure";
import { getExtensionId } from "./runtime";

const secureStorage = new SecureStorage();

// ちゃんと待った方がよいかもしれない
void secureStorage.setPassword(getExtensionId());

export type Store<T> = {
  get: () => Promise<T>;
  set: (value: T) => Promise<void>;
  remove: () => Promise<void>;
  hookAccessor: () => Exclude<Parameters<typeof useStorage>[0], string>;
  watch: (callback: (newValue: T, oldValue: T) => void) => () => void;
};

export const createStore = <T>(
  storage: BaseStorage,
  key: string,
  defaultValue: T
): Store<T> => {
  return {
    get: async (): Promise<T> => {
      const value = await storage.get<T>(key);
      if (value === undefined && defaultValue !== undefined) {
        await storage.set(key, defaultValue);
        return defaultValue;
      }
      return value;
    },
    set: async (value: T): Promise<void> => {
      await storage.set(key, value);
    },
    remove: async (): Promise<void> => {
      await storage.remove(key);
    },
    hookAccessor: (): Exclude<Parameters<typeof useStorage>[0], string> => {
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

export const oauthConsumerKeyStore = createStore(
  secureStorage,
  `${keyPrefix}-oauth-consumer-key`,
  undefined
);

export const oauthConsumerSecretStore = createStore(
  secureStorage,
  `${keyPrefix}-oauth-consumer-secret`,
  undefined
);
