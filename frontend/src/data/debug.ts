import { buildSnapshot } from "@/widgets/snapshot";
import { getRates } from "./rates";
import { getSnapshot, removeEntity, saveEntity } from "./store";
import { getSyncState, requestSync } from "./sync";

// Development builds only: lets the data layer be poked from the browser console or a debugger
// (globalThis.__mybudget). Not part of production bundles. buildWidgetSnapshot shows what the home-screen widgets
// would get, so their numbers can be checked without a phone.
if (__DEV__) {
  (globalThis as Record<string, unknown>).__mybudget = { getSnapshot, saveEntity, removeEntity, requestSync, getSyncState, getRates, buildWidgetSnapshot: buildSnapshot };
}
