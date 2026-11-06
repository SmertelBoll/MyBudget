import { useMemo } from "react";
import type { SelectOption } from "@/components/SelectField";
import { useAuth } from "@/auth/AuthProvider";
import { useCollection } from "@/data/hooks";
import { useRates } from "@/data/rates";
import { useI18n } from "@/i18n/I18nProvider";

// Intl objects are slow to create on the phone's JS engine (Hermes), and the currency list asks for ~170 names:
// one formatter per language, and every name computed once.
const nameCache = new Map<string, Map<string, string>>();
const displayNames = new Map<string, Intl.DisplayNames | null>();

// Localized currency name ("Ukrainian Hryvnia" / "українська гривня"); the code itself when the runtime has no
// Intl.DisplayNames for this language.
export const currencyName = (code: string, lang: string) => {
  let names = nameCache.get(lang);
  if (!names) nameCache.set(lang, (names = new Map()));
  const cached = names.get(code);
  if (cached) return cached;

  if (!displayNames.has(lang)) {
    try {
      displayNames.set(lang, new Intl.DisplayNames([lang], { type: "currency" }));
    } catch {
      displayNames.set(lang, null);
    }
  }
  let name = code;
  try {
    name = displayNames.get(lang)?.of(code) ?? code;
  } catch {
    // Unknown code for this runtime: keep the code.
  }
  names.set(code, name);
  return name;
};

const collators = new Map<string, Intl.Collator>();
const collatorFor = (lang: string) => {
  if (!collators.has(lang)) collators.set(lang, new Intl.Collator(lang));
  return collators.get(lang)!;
};

// Spec 2.2: only currencies we have a rate for. The list comes from the cached (or bundled) rates, so it works
// offline. Full name on the left, code on the right; alphabetical by the name the user reads.
export const useCurrencyOptions = (): SelectOption[] => {
  const { lang } = useI18n();
  const rates = useRates();
  return useMemo(() => {
    const collator = collatorFor(lang);
    return Object.keys(rates.rates)
      .map((code) => ({ value: code, label: currencyName(code, lang), trailing: code }))
      .sort((a, b) => collator.compare(a.label, b.label));
  }, [rates, lang]);
};

const POPULAR = ["USD", "EUR", "GBP", "UAH"];
const PINNED_MAX = 5;

// Top of the currency list: the popular ones, then currencies the user works with (main currency, accounts,
// newest first), at most 5 in all.
export const usePinnedCurrencies = () => {
  const { user } = useAuth();
  const baseCurrency = user?.baseCurrency;
  const accounts = useCollection("accounts");
  return useMemo(() => {
    const used = [...accounts]
      .sort((a, b) => (b.updatedAt ?? "9999").localeCompare(a.updatedAt ?? "9999"))
      .map((account) => account.currency);
    if (baseCurrency) used.unshift(baseCurrency);
    return [...new Set([...POPULAR, ...used])].slice(0, PINNED_MAX);
  }, [accounts, baseCurrency]);
};
