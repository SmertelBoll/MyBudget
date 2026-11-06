// Amounts are integers in minor units (cents) everywhere (spec 2.2); these helpers are the only place that turns
// them into text and back.

export type MoneyFormat = {
  lang: string;
  decimalSeparator: "." | ",";
  // Settings -> Advanced: cents are hidden by default when displaying amounts.
  showCents: boolean;
};

const NBSP = " ";

// Our own symbols for the common currencies: the phone's JS engine (Hermes) has partial Intl data and prints
// "UAH 1,500" where a browser prints "₴1,500". Anything not listed falls back to whatever Intl gives.
const SYMBOLS: Record<string, string> = {
  USD: "$", EUR: "€", GBP: "£", UAH: "₴", PLN: "zł", JPY: "¥", CNY: "¥", CHF: "Fr", CZK: "Kč", TRY: "₺",
  KZT: "₸", INR: "₹", KRW: "₩", ILS: "₪", GEL: "₾", AZN: "₼", HUF: "Ft", RON: "lei", SEK: "kr", NOK: "kr",
  DKK: "kr", CAD: "C$", AUD: "A$", NZD: "NZ$", BRL: "R$", MXN: "Mex$", THB: "฿", VND: "₫", PHP: "₱", NGN: "₦",
};

// "₴32,207" / "₴32 206,83". `exact` always shows cents (balance details, edit fields).
export const formatMoney = (minor: number, currency: string, format: MoneyFormat, exact = false) => {
  const digits = format.showCents || exact ? 2 : 0;
  let parts: Intl.NumberFormatPart[];
  try {
    parts = new Intl.NumberFormat(format.lang, {
      style: "currency",
      currency,
      currencyDisplay: "narrowSymbol",
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).formatToParts(minor / 100);
  } catch {
    return `${(minor / 100).toFixed(digits)} ${currency}`;
  }
  const symbol = SYMBOLS[currency];
  // Intl printed the code ("UAH 1,500") instead of a symbol: the space it adds after a code isn't wanted after "₴".
  const replacedCode = Boolean(symbol) && parts.some((part) => part.type === "currency" && part.value === currency);
  return parts
    .map((part, index) => {
      if (part.type === "currency") return symbol ?? part.value;
      if (replacedCode && part.type === "literal" && /^\s+$/.test(part.value)) {
        const nextToCurrency = parts[index - 1]?.type === "currency" || parts[index + 1]?.type === "currency";
        if (nextToCurrency && symbol.length === 1) return "";
      }
      if (part.type === "decimal") return format.decimalSeparator;
      // Grouping must not look like the chosen decimal separator.
      if (part.type === "group" && part.value === format.decimalSeparator) return NBSP;
      return part.value;
    })
    .join("");
};

export const currencySymbol = (currency: string, lang: string) => {
  if (SYMBOLS[currency]) return SYMBOLS[currency];
  try {
    return (
      new Intl.NumberFormat(lang, { style: "currency", currency, currencyDisplay: "narrowSymbol" })
        .formatToParts(0)
        .find((part) => part.type === "currency")?.value ?? currency
    );
  } catch {
    return currency;
  }
};

// Text typed by the user -> minor units. Either separator is accepted while typing; at most 2 decimals.
// Returns null for anything that isn't a plain non-negative amount.
export const parseAmount = (text: string): number | null => {
  const normalized = text.replace(/[\s ]/g, "").replace(",", ".");
  if (!normalized || normalized === "." || !/^\d*\.?\d{0,2}$/.test(normalized)) return null;
  return Math.round(parseFloat(normalized) * 100);
};

// Account balances may be negative (a credit card): same as parseAmount with an optional leading minus.
export const parseSignedAmount = (text: string): number | null => {
  const trimmed = text.trim();
  if (!trimmed.startsWith("-")) return parseAmount(trimmed);
  const value = parseAmount(trimmed.slice(1));
  return value === null ? null : -value;
};

// Minor units -> text for an input field ("1500.5" -> "1500.50" stays exact; whole amounts lose ".00").
export const amountToInput = (minor: number, decimalSeparator: "." | ",") => {
  const text = (minor / 100).toFixed(2).replace(/\.00$/, "").replace(/^-0$/, "0");
  return decimalSeparator === "," ? text.replace(".", ",") : text;
};
