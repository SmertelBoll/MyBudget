import { useCallback, useMemo } from "react";
import { useAuth } from "@/auth/AuthProvider";
import { useI18n } from "@/i18n/I18nProvider";
import { amountToInput, formatMoney, type MoneyFormat } from "./money";

// Formatting with the user's settings (decimal separator, cents) and language.
export const useMoney = () => {
  const { lang } = useI18n();
  const { user } = useAuth();
  const format: MoneyFormat = useMemo(
    () => ({
      lang,
      decimalSeparator: user?.settings.decimalSeparator ?? ".",
      showCents: user?.settings.showCents ?? false,
    }),
    [lang, user?.settings.decimalSeparator, user?.settings.showCents]
  );

  const money = useCallback(
    (minor: number, currency: string, exact = false) => formatMoney(minor, currency, format, exact),
    [format]
  );
  const toInput = useCallback((minor: number) => amountToInput(minor, format.decimalSeparator), [format]);

  return { money, toInput, format, baseCurrency: user?.baseCurrency ?? "USD" };
};
