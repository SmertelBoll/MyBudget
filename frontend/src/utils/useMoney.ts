import { useCallback, useMemo } from "react";
import { useAuth } from "@/auth/AuthProvider";
import { useI18n } from "@/i18n/I18nProvider";
import { amountToInput, formatMoney, type MoneyFormat, type MoneyKind } from "./money";

// Formatting with the user's settings (decimal separator, cents) and language.
export const useMoney = () => {
  const { lang } = useI18n();
  const { user } = useAuth();
  const format: MoneyFormat = useMemo(
    () => ({
      lang,
      decimalSeparator: user?.settings.decimalSeparator ?? ".",
      // Before there were two switches there was one (showCents) for totals; entries always had cents. Unset, the
      // new switches keep that.
      centsInEntries: user?.settings.centsInEntries ?? true,
      centsInTotals: user?.settings.centsInTotals ?? user?.settings.showCents ?? false,
    }),
    [lang, user?.settings.decimalSeparator, user?.settings.centsInEntries, user?.settings.centsInTotals, user?.settings.showCents]
  );

  // kind: "total" (default), "entry", or "exact" / true for always with cents.
  const money = useCallback(
    (minor: number, currency: string, kind: MoneyKind | boolean = "total") =>
      formatMoney(minor, currency, format, kind === true ? "exact" : kind === false ? "total" : kind),
    [format]
  );
  const toInput = useCallback((minor: number) => amountToInput(minor, format.decimalSeparator), [format]);

  return { money, toInput, format, baseCurrency: user?.baseCurrency ?? "USD" };
};
