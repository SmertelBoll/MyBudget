// Used until /currencies answers (first launch offline). The full list comes from the server's rate source.
export const FALLBACK_CURRENCIES = ["UAH", "USD", "EUR", "PLN", "GBP", "CHF", "CZK", "CAD", "JPY", "CNY", "TRY"];

// Localized currency name ("Ukrainian Hryvnia" / "українська гривня"); the code itself when the runtime has no
// Intl.DisplayNames for this language.
export const currencyName = (code: string, lang: string) => {
  try {
    return new Intl.DisplayNames([lang], { type: "currency" }).of(code) ?? code;
  } catch {
    return code;
  }
};
