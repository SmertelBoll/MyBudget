import * as SecureStore from "expo-secure-store";
import Storage from "expo-sqlite/kv-store";
import type { KeyValueStore } from "./types";

// Two stores (spec 3.4): `secureStorage` for tokens (Keychain / Keystore), `storage` for everything else (cached
// user, dictionaries, preferences): iOS may reject large values in the Keychain, so caches never go there.
// The browser build uses storage.web.ts instead.

export const secureStorage: KeyValueStore = {
  get: (key) => SecureStore.getItemAsync(key),
  set: (key, value) => SecureStore.setItemAsync(key, value),
  remove: (key) => SecureStore.deleteItemAsync(key),
};

export const storage: KeyValueStore = {
  get: (key) => Storage.getItem(key),
  set: (key, value) => Storage.setItem(key, value),
  remove: (key) => Storage.removeItem(key),
};
