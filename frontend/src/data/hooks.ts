import { useCallback, useSyncExternalStore } from "react";
import { getRecord, getSnapshot, subscribe } from "./store";
import { getSyncState, subscribeSync } from "./sync";
import type { Collection, EntityMap, Entry, Transaction } from "./types";

// All live records of a collection; re-renders when they change (local edit or sync).
export const useCollection = <C extends Collection>(collection: C): EntityMap[C][] =>
  useSyncExternalStore(subscribe, () => getSnapshot(collection));

export const useRecord = <C extends Collection>(collection: C, id: string | null | undefined) =>
  useSyncExternalStore(
    subscribe,
    useCallback(() => (id ? getRecord(collection, id) : undefined), [collection, id])
  );

// The entries the user sees: every transaction but balance corrections. Kept while the collection stays the same
// array, so every screen shares one filtered list.
let entries: { from: Transaction[]; result: Entry[] } | null = null;
export const visibleEntries = (all: Transaction[]): Entry[] => {
  if (entries?.from !== all) entries = { from: all, result: all.filter((tx): tx is Entry => !tx.isCorrection && tx.categoryId !== null) };
  return entries.result;
};

export const useEntries = () => visibleEntries(useCollection("transactions"));

export const useSyncState = () => useSyncExternalStore(subscribeSync, getSyncState);
