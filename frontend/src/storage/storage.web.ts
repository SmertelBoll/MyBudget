import type { KeyValueStore } from "./types";

// Browser build, used for development only: SecureStore doesn't exist on web, so both stores are localStorage.
const webStore: KeyValueStore = {
  get: async (key) => globalThis.localStorage?.getItem(key) ?? null,
  set: async (key, value) => globalThis.localStorage?.setItem(key, value),
  remove: async (key) => globalThis.localStorage?.removeItem(key),
};

export const secureStorage = webStore;
export const storage = webStore;
