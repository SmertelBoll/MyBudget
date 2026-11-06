import { useMemo } from "react";
import type { SelectOption } from "@/components/SelectField";
import { useAuth } from "@/auth/AuthProvider";
import { useCollection } from "@/data/hooks";
import { useRates } from "@/data/rates";
import { useI18n } from "@/i18n/I18nProvider";

// Localized currency name ("Ukrainian Hryvnia" / "українська гривня"); the code itself when the runtime has no
// Intl.DisplayNames for this language.
export const currencyName = (code: string, lang: string) => {
  try {
    return new Intl.DisplayNames([lang], { type: "currency" }).of(code) ?? code;
  } catch {
    return code;
  }
};

// Spec 2.2: only currencies we have a rate for. The list comes from the cached (or bundled) rates, so it works
// offline. Full name on the left, code on the right; alphabetical by the name the user reads.
export const useCurrencyOptions = (): SelectOption[] => {
  const { lang } = useI18n();
  const rates = useRates();
  return useMemo(
    () =>
      Object.keys(rates.rates)
        .map((code) => ({ value: code, label: currencyName(code, lang), trailing: code }))
        .sort((a, b) => a.label.localeCompare(b.label, lang)),
    [rates, lang]
  );
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
