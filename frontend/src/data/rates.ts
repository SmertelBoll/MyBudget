import { useSyncExternalStore } from "react";
import { api } from "@/api/client";
import { readJson, writeJson } from "@/storage/json";
import FALLBACK from "./fallback-rates.json";

// Spec 2.2: rates come from the backend (refreshed daily there), are cached on the device with their date, and a
// snapshot is bundled for a first launch without internet. All rates are per 1 USD.

export type Rates = { base: string; rates: Record<string, number>; fetchedAt: string };

const CACHE_KEY = "rates";

let current: Rates = FALLBACK as Rates;
const listeners = new Set<() => void>();

const set = (next: Rates) => {
  current = next;
  listeners.forEach((listener) => listener());
};

export const getRates = () => current;

export const loadRates = async () => {
  const cached = await readJson<Rates>(CACHE_KEY);
  if (cached && cached.fetchedAt > current.fetchedAt) set(cached);
  try {
    const fresh = await api.get<Rates>("/rates", { auth: false });
    set(fresh);
    await writeJson(CACHE_KEY, fresh);
  } catch {
    // Offline: the cached or bundled rates stay; screens show their date.
  }
};

// How many `to` units one `from` unit buys.
export const rateBetween = (from: string, to: string, rates: Rates = current) => {
  if (from === to) return 1;
  const fromRate = rates.rates[from];
  const toRate = rates.rates[to];
  return fromRate && toRate ? toRate / fromRate : null;
};

// Minor units of `from` -> minor units of `to` at the current rate; null for a currency without a rate.
export const convert = (minor: number, from: string, to: string, rates: Rates = current) => {
  const rate = rateBetween(from, to, rates);
  return rate === null ? null : Math.round(minor * rate);
};

export const useRates = () =>
  useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getRates
  );
