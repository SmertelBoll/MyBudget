import { useMemo } from "react";
import type { SelectOption } from "@/components/SelectField";
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
// offline.
export const useCurrencyOptions = (): SelectOption[] => {
  const { lang } = useI18n();
  const rates = useRates();
  return useMemo(
    () =>
      Object.keys(rates.rates)
        .sort()
        .map((code) => {
          const name = currencyName(code, lang);
          return { value: code, label: code, subtitle: name === code ? undefined : name };
        }),
    [rates, lang]
  );
};
