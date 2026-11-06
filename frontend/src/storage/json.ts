import { storage } from "./storage";

export const readJson = async <T,>(key: string): Promise<T | null> => {
  const raw = await storage.get(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
};

export const writeJson = (key: string, value: unknown) => storage.set(key, JSON.stringify(value));
