// Turns the lines ML Kit read from a receipt photo into items, tax, total, date and store. English receipts:
// "NAME ... PRICE" rows, then SUBTOTAL / TAX / TOTAL, then the payment. Recognition and layouts vary, so this is a
// best guess the user reviews; nothing here is final. Amounts are in cents. No app imports: tested on its own.

export type OcrLine = { text: string; left: number; top: number; right: number; bottom: number };
export type ReceiptItem = { name: string; amount: number };
export type ParsedReceipt = {
  merchant: string | null;
  date: string | null;
  items: ReceiptItem[];
  tax: number | null;
  total: number | null;
};

type Row = { text: string; center: number; height: number; lines: OcrLine[] };

// ML Kit often reads the name column and the price column as separate blocks: lines whose middles are on the same
// level are put back into one row, left to right.
export const groupRows = (lines: OcrLine[]): string[] => {
  const sorted = [...lines]
    .filter((line) => line.text.trim())
    .sort((a, b) => a.top + a.bottom - (b.top + b.bottom));
  const rows: Row[] = [];
  for (const line of sorted) {
    const center = (line.top + line.bottom) / 2;
    const height = Math.max(1, line.bottom - line.top);
    const row = rows.find((candidate) => Math.abs(candidate.center - center) < Math.min(candidate.height, height) * 0.6);
    if (row) {
      row.lines.push(line);
      row.center = row.lines.reduce((sum, item) => sum + (item.top + item.bottom) / 2, 0) / row.lines.length;
    } else {
      rows.push({ text: "", center, height, lines: [line] });
    }
  }
  return rows
    .sort((a, b) => a.center - b.center)
    .map((row) =>
      row.lines
        .sort((a, b) => a.left - b.left)
        .map((line) => line.text.trim())
        .join(" ")
    );
};

// A price at the end of a row: "4.99", "$4.99", "1,299.00", "4.99 A" (tax flag), "1.00-" (a discount).
const PRICE_AT_END = /(-)?\s*[$S]?\s*(\d{1,3}(?:,\d{3})+|\d+)\s?[.,]\s?(\d{2})\s*(-)?\s*(?:[A-Z]{1,2}|\*)?\s*$/;

const toCents = (whole: string, fraction: string) => Number(whole.replace(/,/g, "")) * 100 + Number(fraction);

const priceOf = (row: string) => {
  const match = row.match(PRICE_AT_END);
  if (!match || match.index === undefined) return null;
  const negative = Boolean(match[1] || match[4]);
  const cents = toCents(match[2], match[3]);
  return { amount: negative ? -cents : cents, rest: row.slice(0, match.index).trim() };
};

const letters = (text: string) => (text.match(/[A-Za-z]/g) ?? []).length;

const SUBTOTAL = /\bsub\s*-?\s*tota?l\b/i;
const TOTAL = /^(grand\s+)?total\b(?!\s*(savings?|saved|items?|discount|tax))|\b(amount|balance|total)\s+due\b|^amount\b/i;
const TAX = /\b(sales\s+)?(tax|vat|gst|hst|pst)\b/i;
const DISCOUNT = /\b(discount|coupon|savings?|promo|saved|instant\s+off|markdown)\b/i;
// After the total: how it was paid, change, card details. Before it, such words mean the row isn't an item either.
const NOT_ITEM = /\b(cash|change|tender|visa|mastercard|amex|discover|debit|credit|card|payment|paid|auth|approval|balance|tip|gratuity|items?\s+sold|qty|quantity)\b/i;
// "2 @ 1.99", "1.25 lb @ 3.99 / lb": the quantity line of an item, whose name is on the row above.
const QUANTITY = /(\d\s*[@x]\s*[$S]?\d)|(\/\s*(lb|kg|oz|ea)\b)|\b\d+(\.\d+)?\s*(lb|kg)\b/i;

const cleanName = (text: string) =>
  text
    .replace(/\b\d{5,}\b/g, " ") // product codes
    .replace(/^[\d\s#*.-]+(?=[A-Za-z])/, "") // leading line numbers / quantities
    .replace(/[|_*]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const pad = (value: number) => String(value).padStart(2, "0");
const validDate = (year: number, month: number, day: number) =>
  year >= 2000 && year <= 2100 && month >= 1 && month <= 12 && day >= 1 && day <= 31 ? `${year}-${pad(month)}-${pad(day)}` : null;

// US order (month first) unless the first number can't be a month.
export const findDate = (rows: string[]) => {
  for (const row of rows) {
    let match = row.match(/\b(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/);
    if (match) {
      const found = validDate(+match[1], +match[2], +match[3]);
      if (found) return found;
    }
    match = row.match(/\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})\b/);
    if (match) {
      const year = match[3].length === 2 ? 2000 + Number(match[3]) : Number(match[3]);
      const [a, b] = [Number(match[1]), Number(match[2])];
      const found = a > 12 ? validDate(year, b, a) : validDate(year, a, b);
      if (found) return found;
    }
    match = row.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2}),?\s+(20\d{2})\b/i);
    if (match) {
      const found = validDate(+match[3], MONTHS.indexOf(match[1].toLowerCase()) + 1, +match[2]);
      if (found) return found;
    }
    match = row.match(/\b(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?,?\s+(20\d{2})\b/i);
    if (match) {
      const found = validDate(+match[3], MONTHS.indexOf(match[2].toLowerCase()) + 1, +match[1]);
      if (found) return found;
    }
  }
  return null;
};

// The store: the first of the top rows that reads like a name (letters, no price, not a greeting or an address).
const findMerchant = (rows: string[]) => {
  for (const row of rows.slice(0, 5)) {
    const text = row.trim();
    const digits = (text.match(/\d/g) ?? []).length;
    if (letters(text) < 3 || digits > letters(text) / 2 || priceOf(text)) continue;
    if (/\b(welcome|receipt|thank|store\s*#|tel|phone|www\.|\.com)\b/i.test(text)) continue;
    return text.replace(/\s{2,}/g, " ");
  }
  return null;
};

export const parseReceiptRows = (rows: string[]): ParsedReceipt => {
  const items: ReceiptItem[] = [];
  let tax: number | null = null;
  let total: number | null = null;
  let subtotal: number | null = null;
  // A row with a name and no price: its price may be on the quantity row below.
  let pendingName: string | null = null;

  for (const row of rows) {
    const price = priceOf(row);
    if (!price) {
      const name = cleanName(row);
      pendingName = letters(name) >= 2 && !NOT_ITEM.test(name) && !TOTAL.test(name) ? name : null;
      continue;
    }
    const label = price.rest;
    if (SUBTOTAL.test(label)) {
      subtotal = price.amount;
      pendingName = null;
      continue;
    }
    if (TAX.test(label) && !DISCOUNT.test(label)) {
      tax = (tax ?? 0) + price.amount;
      pendingName = null;
      continue;
    }
    if (TOTAL.test(label)) {
      total = price.amount;
      break; // the rest is payment
    }
    if (DISCOUNT.test(label) || (price.amount < 0 && letters(label) < 2)) {
      // Taken off the item above it.
      const last = items[items.length - 1];
      if (last) last.amount = Math.max(0, last.amount - Math.abs(price.amount));
      pendingName = null;
      continue;
    }
    if (QUANTITY.test(label) && pendingName) {
      items.push({ name: pendingName, amount: price.amount });
      pendingName = null;
      continue;
    }
    const name = cleanName(label);
    if (letters(name) < 2 || NOT_ITEM.test(name) || price.amount <= 0) {
      pendingName = null;
      continue;
    }
    items.push({ name, amount: price.amount });
    pendingName = null;
  }

  // No total line read: the subtotal plus tax, or the items.
  if (total === null && subtotal !== null) total = subtotal + (tax ?? 0);
  return { merchant: findMerchant(rows), date: findDate(rows), items, tax, total };
};

export const parseReceipt = (lines: OcrLine[]) => parseReceiptRows(groupRows(lines));
