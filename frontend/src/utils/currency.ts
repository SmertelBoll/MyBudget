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

// Only these get their sign in the list: elsewhere it's either the code again or a sign several currencies share.
const SIGN_IN_LABEL: Record<string, string> = { USD: "$", EUR: "€", GBP: "£", UAH: "₴", CNY: "¥" };
const labelFor = (code: string, lang: string) => {
  const name = currencyName(code, lang);
  return SIGN_IN_LABEL[code] ? `${name} (${SIGN_IN_LABEL[code]})` : name;
};

// Spec 2.2: only currencies we have a rate for. The list comes from the cached (or bundled) rates, so it works
// offline. Full name on the left (with the sign for the best-known ones: "British Pound (£)"), code on the right;
// alphabetical by the name the user reads.
export const useCurrencyOptions = (): SelectOption[] => {
  const { lang } = useI18n();
  const rates = useRates();
  return useMemo(() => {
    const collator = collatorFor(lang);
    return Object.keys(rates.rates)
      .map((code) => ({ value: code, label: labelFor(code, lang), trailing: code }))
      .sort((a, b) => collator.compare(a.label, b.label));
  }, [rates, lang]);
};

const POPULAR = ["USD", "EUR", "GBP", "UAH"];
const PINNED_MAX = 5;

// Top of the currency list, at most 5: currencies the user actually works with come first (entries, accounts and the
// main currency, most recently used first), the popular ones fill whatever room is left.
export const usePinnedCurrencies = () => {
  const { user } = useAuth();
  const baseCurrency = user?.baseCurrency;
  const accounts = useCollection("accounts");
  const transactions = useCollection("transactions");
  return useMemo(() => {
    const lastUsed = new Map<string, string>();
    const touch = (code: string, at: string | undefined) => {
      const stamp = at ?? "";
      if ((lastUsed.get(code) ?? "") <= stamp) lastUsed.set(code, stamp);
    };
    for (const entry of transactions) touch(entry.currency, entry.updatedAt ?? entry.clientCreatedAt);
    for (const account of accounts) touch(account.currency, account.updatedAt);
    if (baseCurrency) touch(baseCurrency, lastUsed.get(baseCurrency));
    const used = [...lastUsed.entries()].sort((a, b) => b[1].localeCompare(a[1])).map(([code]) => code);
    return [...new Set([...used, ...POPULAR])].slice(0, PINNED_MAX);
  }, [accounts, transactions, baseCurrency]);
};
