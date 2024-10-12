import type { BaseStorage, StorageCallbackMap } from "@plasmohq/storage";
import { Storage } from "@plasmohq/storage";
import { SecureStorage } from "@plasmohq/storage/secure";
import { createStore as createJotaiStore } from "jotai";
import { atomWithStorage } from "jotai/utils";
import type { AsyncStorage } from "jotai/vanilla/utils/atomWithStorage";
import { getExtensionId } from "./runtime";

export const jotaiStore = createJotaiStore();

const keyPrefix = "quick-zaim-ext";
export const extensionStorage = new Storage();
export const extensionSecureStorage = new SecureStorage();

const waitSecureStorageReady = extensionSecureStorage.setPassword(
	getExtensionId(),
);

export const atomWithExtensionStorage = <T>(key: string, initialValue: T) => {
	return atomWithStorage(
		`${keyPrefix}-${key}`,
		initialValue,
		createJotaiStorageAdapter(extensionStorage),
		{ getOnInit: true },
	);
};

export const atomWithExtensionSecureStorage = <T>(
	key: string,
	initialValue: T,
) => {
	return atomWithStorage(
		`${keyPrefix}-${key}`,
		initialValue,
		createJotaiStorageAdapter(extensionSecureStorage),
		{ getOnInit: true },
	);
};

export const createJotaiStorageAdapter = <T>(
	storage: BaseStorage,
): AsyncStorage<T> => {
	return {
		getItem: async (key: string, initialValue: T) => {
			await waitSecureStorageReady;

			try {
				const value = await storage.get<T>(key);
				return value ?? initialValue;
			} catch {
				return initialValue;
			}
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
