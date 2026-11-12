// Pictures shown in Android's widget list instead of the app icon: each widget drawn as it looks on the home screen
// (src/widgets/WidgetViews.tsx), with made-up sample numbers, since the pictures ship inside the app.
//   node design/widgets/make-previews.cjs        (uses design/logo's node_modules; run npm install there once)
const fs = require("fs");
const path = require("path");
const { Resvg } = require("../logo/node_modules/@resvg/resvg-js");

const OUT = path.resolve(__dirname, "../../frontend/assets/widget-preview");
const BG = "#171717";
const TEXT = "#FAF8FF";
const MUTED = "#999999";
const ACCENT = "#F9F919";
const ON_ACCENT = "#0C1618";
const FONT = "Roboto, 'Segoe UI', Arial, sans-serif";
// 2 px per dp, like a typical phone.
const S = 2;

const SAMPLE = {
  name: "Total",
  balance: "$1,250.00",
  second: { name: "Card", balance: "$830.40" },
  spentLabel: "Spent this month",
  spent: "$467.30",
  top: [
    ["Groceries", "#42A5F5", 214.9],
    ["Cafe", "#FFA726", 107.96],
    ["Transport", "#66BB6A", 64.15],
    ["Home", "#AB47BC", 52.3],
    ["Fun", "#EF5350", 27.99],
  ],
};

const text = (x, y, value, size, color, weight = 400, anchor = "start") =>
  `<text x="${x * S}" y="${y * S}" font-family="${FONT}" font-size="${size * S}" font-weight="${weight}" fill="${color}" text-anchor="${anchor}">${value}</text>`;
const card = (w, h) => `<rect width="${w * S}" height="${h * S}" rx="${16 * S}" fill="${BG}"/>`;
const svg = (w, h, body) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w * S}" height="${h * S}">${body}</svg>`;
const write = (name, w, h, body) => {
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, name), new Resvg(svg(w, h, body), { font: { loadSystemFonts: true } }).render().asPng());
  console.log("  ", path.relative(process.cwd(), path.join(OUT, name)));
};

// 1×1: the yellow square with "+".
write("quick-add.png", 72, 72, `<rect width="${72 * S}" height="${72 * S}" rx="${20 * S}" fill="${ACCENT}"/>` + text(36, 50, "+", 40, ON_ACCENT, 700, "middle"));

// 2×1: name and a big balance.
write("balance.png", 180, 80, card(180, 80) + text(12, 30, SAMPLE.name, 12, MUTED) + text(12, 60, SAMPLE.balance, 28, TEXT, 700));

// The first account big, a second one smaller, then the month line, starting `top` dp down at `x`.
const stack = (x, top) =>
  text(x, top + 13, SAMPLE.name, 13, MUTED) +
  text(x, top + 44, SAMPLE.balance, 28, TEXT, 700) +
  text(x, top + 64, SAMPLE.second.name, 11, MUTED) +
  text(x, top + 83, SAMPLE.second.balance, 16, TEXT, 700) +
  text(x, top + 104, SAMPLE.spentLabel, 11, MUTED) +
  text(x, top + 123, SAMPLE.spent, 15, TEXT, 700);

// 2×2: two accounts and this month's spending.
write("summary.png", 180, 180, card(180, 180) + stack(14, 24));

// 4×2: two accounts and spending on the left, five categories with bars on the right.
const W = 360;
const H = 180;
const total = SAMPLE.top.reduce((sum, [, , amount]) => sum + amount, 0);
const barMax = W / 2 - 40;
const rows = SAMPLE.top
  .map(([name, color, amount], i) => {
    const y = 34 + i * 28;
    return (
      text(194, y, name, 12, TEXT) +
      text(W - 14, y, `$${amount.toFixed(2)}`, 12, MUTED, 400, "end") +
      `<rect x="${194 * S}" y="${(y + 5) * S}" width="${Math.max(4, Math.round((barMax * amount) / total)) * S}" height="${4 * S}" rx="${2 * S}" fill="${color}"/>`
    );
  })
  .join("");
write(
  "overview.png",
  W,
  H,
  card(W, H) + stack(14, 24) + rows
);
