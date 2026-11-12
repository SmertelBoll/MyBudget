import { useCallback, useMemo } from "react";
import { useAuth } from "@/auth/AuthProvider";
import { useI18n } from "@/i18n/I18nProvider";
import type { UserSettings } from "@/api/types";
import { amountToInput, formatMoney, type MoneyFormat, type MoneyKind } from "./money";

// The four Cents switches as they stand. Unset ones: entries keep cents (rows always had them); the others follow the
// one switch there used to be (showCents, for totals).
export const centsSettings = (settings?: Partial<UserSettings>) => {
  const totals = settings?.centsInTotals ?? settings?.showCents ?? false;
  return {
    centsInEntries: settings?.centsInEntries ?? true,
    centsInHome: settings?.centsInHome ?? totals,
    centsInAccounts: settings?.centsInAccounts ?? totals,
    centsInTotals: totals,
    centsInWidgets: settings?.centsInWidgets ?? true,
  };
};

// Formatting with the user's settings (decimal separator, cents) and language.
export const useMoney = () => {
  const { lang } = useI18n();
  const { user } = useAuth();
  const format: MoneyFormat = useMemo(
    () => ({
      lang,
      decimalSeparator: user?.settings.decimalSeparator ?? ".",
      ...centsSettings(user?.settings),
    }),
    [lang, user?.settings]
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
