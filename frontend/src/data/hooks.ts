import { useCallback, useSyncExternalStore } from "react";
import { getRecord, getSnapshot, subscribe } from "./store";
import { getSyncState, subscribeSync } from "./sync";
import type { Collection, EntityMap } from "./types";

// All live records of a collection; re-renders when they change (local edit or sync).
export const useCollection = <C extends Collection>(collection: C): EntityMap[C][] =>
  useSyncExternalStore(subscribe, () => getSnapshot(collection));

export const useRecord = <C extends Collection>(collection: C, id: string | null | undefined) =>
  useSyncExternalStore(
    subscribe,
    useCallback(() => (id ? getRecord(collection, id) : undefined), [collection, id])
  );

export const useSyncState = () => useSyncExternalStore(subscribeSync, getSyncState);
