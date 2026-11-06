import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { getLocales } from "expo-localization";
import { api } from "@/api/client";
import { readJson, writeJson } from "@/storage/json";
import BUNDLED_EN from "./en.json";
import { DEFAULT_LANGUAGE, LANGUAGE_CODES } from "./languages";

// Spec 2.4: dictionaries come from the server and are cached on the device; English is bundled for the very first
// offline launch. Every user-facing string goes through t(key).

type Strings = Record<string, string>;
type Params = Record<string, string | number>;
type CachedDictionary = { updatedAt: string | null; strings: Strings };

type I18nContextValue = {
  lang: string;
  t: (key: string, params?: Params) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

const cacheKey = (lang: string) => `i18n.${lang}`;

export const deviceLanguage = () => {
  const code = getLocales()[0]?.languageCode;
  return code && LANGUAGE_CODES.includes(code) ? code : DEFAULT_LANGUAGE;
};

const pluralRule = (lang: string, count: number) => {
  try {
    return new Intl.PluralRules(lang).select(count);
  } catch {
    return count === 1 ? "one" : "other";
  }
};

export function I18nProvider({ lang, children }: { lang: string; children: ReactNode }) {
  // Tagged with its language, so after a switch the old dictionary isn't shown while the new one loads (English is).
  const [loaded, setLoaded] = useState<{ lang: string; strings: Strings }>({ lang, strings: {} });
  const strings = useMemo<Strings>(() => (loaded.lang === lang ? loaded.strings : {}), [loaded, lang]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const cached = await readJson<CachedDictionary>(cacheKey(lang));
      if (cached && !cancelled) setLoaded({ lang, strings: cached.strings });
      try {
        const fresh = await api.get<CachedDictionary>(`/i18n/${lang}`, { auth: false });
        if (cancelled) return;
        setLoaded({ lang, strings: fresh.strings });
        await writeJson(cacheKey(lang), fresh);
      } catch {
        // Offline or server asleep: the cached (or bundled English) dictionary stays.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [lang]);

  // Lookup order: chosen language, then English, then the key itself (so a missing key is visible, not blank).
  // Plurals: "key_one" / "key_few" / "key_other" by the language's rules, when params.count is given.
  const t = useCallback(
    (key: string, params?: Params) => {
      const lookup = (k: string) => strings[k] ?? (BUNDLED_EN as Strings)[k];
      let text: string | undefined;
      if (typeof params?.count === "number") {
        text = lookup(`${key}_${pluralRule(lang, params.count)}`) ?? lookup(`${key}_other`);
      }
      text ??= lookup(key) ?? key;
      if (!params) return text;
      return text.replace(/\{\{(\w+)\}\}/g, (match, name: string) =>
        params[name] === undefined ? match : String(params[name])
      );
    },
    [strings, lang]
  );

  const value = useMemo(() => ({ lang, t }), [lang, t]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export const useI18n = () => {
  const value = useContext(I18nContext);
  if (!value) throw new Error("useI18n outside I18nProvider");
  return value;
};
