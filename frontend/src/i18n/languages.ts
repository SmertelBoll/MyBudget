import { useEffect, useMemo, useState } from "react";
import { api } from "@/api/client";
import type { SelectOption } from "@/components/SelectField";
import { readJson, writeJson } from "@/storage/json";

// Same list as backend/utils/languages.js (and the MovieList site). Native names are never translated; the English
// name is shown under it and is searchable too.
export const LANGUAGES = [
  { code: "en", nativeName: "English", name: "English" },
  { code: "uk", nativeName: "Українська", name: "Ukrainian" },
  { code: "de", nativeName: "Deutsch", name: "German" },
  { code: "fr", nativeName: "Français", name: "French" },
  { code: "es", nativeName: "Español", name: "Spanish" },
  { code: "it", nativeName: "Italiano", name: "Italian" },
  { code: "pl", nativeName: "Polski", name: "Polish" },
  { code: "pt", nativeName: "Português", name: "Portuguese" },
  { code: "ja", nativeName: "日本語", name: "Japanese" },
  { code: "ko", nativeName: "한국어", name: "Korean" },
  { code: "zh", nativeName: "中文", name: "Chinese" },
  { code: "tr", nativeName: "Türkçe", name: "Turkish" },
  { code: "ar", nativeName: "العربية", name: "Arabic" },
  { code: "hi", nativeName: "हिन्दी", name: "Hindi" },
  { code: "cs", nativeName: "Čeština", name: "Czech" },
  { code: "da", nativeName: "Dansk", name: "Danish" },
  { code: "el", nativeName: "Ελληνικά", name: "Greek" },
  { code: "fi", nativeName: "Suomi", name: "Finnish" },
  { code: "hu", nativeName: "Magyar", name: "Hungarian" },
  { code: "nl", nativeName: "Nederlands", name: "Dutch" },
  { code: "no", nativeName: "Norsk", name: "Norwegian" },
  { code: "sv", nativeName: "Svenska", name: "Swedish" },
] as const;

export const DEFAULT_LANGUAGE = "en";

export const LANGUAGE_CODES: string[] = LANGUAGES.map((lang) => lang.code);

const toOption = (lang: (typeof LANGUAGES)[number]): SelectOption => ({
  value: lang.code,
  label: lang.nativeName,
  subtitle: lang.name === lang.nativeName ? undefined : lang.name,
});

export const LANGUAGE_OPTIONS: SelectOption[] = LANGUAGES.map(toOption);

// Only languages with a dictionary on the server (spec 2.4: a new language is added there, without an app update).
// The list is cached; the current language is always offered.
const AVAILABLE_KEY = "i18n.available";
let available: string[] | null = null;
const subscribers = new Set<(codes: string[]) => void>();

const loadAvailable = async () => {
  if (!available) available = (await readJson<string[]>(AVAILABLE_KEY)) ?? [DEFAULT_LANGUAGE];
  try {
    const { available: fresh } = await api.get<{ available?: string[] }>("/i18n", { auth: false });
    if (fresh?.length) {
      available = fresh;
      await writeJson(AVAILABLE_KEY, fresh);
    }
  } catch {
    // Offline: the cached list stays.
  }
  subscribers.forEach((notify) => notify(available!));
};

export const useLanguageOptions = (current?: string | null) => {
  const [codes, setCodes] = useState<string[]>(() => available ?? [DEFAULT_LANGUAGE]);
  useEffect(() => {
    subscribers.add(setCodes);
    loadAvailable();
    return () => {
      subscribers.delete(setCodes);
    };
  }, []);
  return useMemo(() => LANGUAGES.filter((lang) => codes.includes(lang.code) || lang.code === current).map(toOption), [codes, current]);
};
