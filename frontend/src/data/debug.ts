import { getSnapshot, removeEntity, saveEntity } from "./store";
import { getSyncState, requestSync } from "./sync";

// Development builds only: lets the data layer be poked from the browser console or a debugger
// (globalThis.__mybudget). Not part of production bundles.
if (__DEV__) {
  (globalThis as Record<string, unknown>).__mybudget = { getSnapshot, saveEntity, removeEntity, requestSync, getSyncState };
}
