// Checks of the receipt parser on typical English receipts: npm run test:receipt
import assert from "node:assert/strict";
import { parseReceipt, parseReceiptRows } from "../src/data/receiptParser.ts";

// Lines laid out as ML Kit returns them: the name column and the price column as separate lines on the same level,
// with small vertical jitter.
const layout = (rows: [string, string?][]) => {
  const lines = [];
  rows.forEach(([left, right], i) => {
    const top = 100 + i * 40 + (i % 3);
    if (left) lines.push({ text: left, left: 20, top, right: 300, bottom: top + 28 });
    if (right) lines.push({ text: right, left: 520, top: top + 2, right: 600, bottom: top + 29 });
  });
  // Blocks come column by column.
  return lines.sort((a, b) => a.left - b.left || a.top - b.top);
};

// A supermarket receipt.
const walmart = parseReceipt(
  layout([
    ["WALMART"],
    ["Save money. Live better."],
    ["(555) 123-4567"],
    ["ST# 1234 OP# 00001 TE# 12"],
    ["MILK 2% GAL 007874235187", "3.48 N"],
    ["BANANAS", ""],
    ["2.31 lb @ 0.58 /lb", "1.34 N"],
    ["BREAD WHT 007225003712", "2.50 N"],
    ["COUPON", "0.50-"],
    ["PAPER TOWEL 003700074", "12.97 T"],
    ["SUBTOTAL", "19.79"],
    ["TAX 1 7.000 %", "0.91"],
    ["TOTAL", "20.70"],
    ["VISA TEND", "20.70"],
    ["CHANGE DUE", "0.00"],
    ["11/07/26 14:32:10"],
  ])
);
console.log(walmart);
assert.equal(walmart.merchant, "WALMART");
assert.equal(walmart.date, "2026-11-07");
assert.deepEqual(walmart.items, [
  { name: "MILK 2% GAL", amount: 348 },
  { name: "BANANAS", amount: 134 },
  { name: "BREAD WHT", amount: 200 },
  { name: "PAPER TOWEL", amount: 1297 },
]);
assert.equal(walmart.tax, 91);
assert.equal(walmart.total, 2070);

// A cafe receipt on one column, "$" prices, a date with a month name, quantities in front.
const cafe = parseReceiptRows([
  "Blue Bottle Coffee",
  "123 Main St, Oakland CA",
  "Nov 3, 2026 9:41 AM",
  "1 Latte $5.50",
  "2 Croissant $8.00",
  "Subtotal $13.50",
  "Sales Tax $1.18",
  "Tip $2.00",
  "Total $16.68",
  "Mastercard **** 1234",
]);
console.log(cafe);
assert.equal(cafe.merchant, "Blue Bottle Coffee");
assert.equal(cafe.date, "2026-11-03");
assert.deepEqual(cafe.items, [
  { name: "Latte", amount: 550 },
  { name: "Croissant", amount: 800 },
]);
assert.equal(cafe.tax, 118);
assert.equal(cafe.total, 1668);

// No TOTAL read: subtotal plus tax; prices with a thousands separator; ISO date.
const store = parseReceiptRows(["BEST BUY", "2026-10-30", "TV 55IN", "1,299.99", "TV 55IN 4K 1,299.99", "SUBTOTAL 1,299.99", "TAX 104.00"]);
console.log(store);
assert.equal(store.date, "2026-10-30");
assert.deepEqual(store.items, [{ name: "TV 55IN 4K", amount: 129999 }]);
assert.equal(store.total, 140399);

console.log("all receipt checks passed");
