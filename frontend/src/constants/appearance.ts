import type { MaterialCommunityIcons } from "@expo/vector-icons";

// Spec 5.2: the allowed icons and colors for accounts and categories live in one place.

export type IconName = keyof typeof MaterialCommunityIcons.glyphMap;
export type IconSection = { title: string; icons: IconName[] };

// Section titles are dictionary keys.
export const ACCOUNT_ICON_SECTIONS: IconSection[] = [
  {
    title: "icons.money",
    icons: [
      "cash", "cash-multiple", "bank", "bank-outline", "credit-card", "credit-card-outline",
      "credit-card-multiple-outline", "contactless-payment", "wallet", "wallet-outline", "piggy-bank",
      "piggy-bank-outline", "safe", "safe-square-outline", "hand-coin", "account-cash", "treasure-chest", "gift",
    ],
  },
  {
    title: "icons.currencies",
    icons: ["currency-usd", "currency-eur", "currency-gbp", "currency-uah", "currency-jpy", "currency-btc"],
  },
  {
    title: "icons.investments",
    icons: ["chart-line", "finance", "gold", "diamond-stone", "bitcoin", "ethereum", "litecoin"],
  },
  {
    title: "icons.other",
    icons: ["briefcase", "home-city", "cellphone", "apple", "google"],
  },
];

export const DEFAULT_ACCOUNT_ICON: IconName = "credit-card-outline";

// The row shown under the form (spec 5.2); "more" opens the full palette.
export const QUICK_COLORS = ["#42a5f5", "#66bb6a", "#ffa726", "#ef5350", "#ab47bc", "#26a69a", "#8d6e63"];

export const DEFAULT_COLOR = QUICK_COLORS[0];

const hslToHex = (h: number, s: number, l: number) => {
  const a = (s / 100) * Math.min(l / 100, 1 - l / 100);
  const channel = (n: number) => {
    const k = (n + h / 30) % 12;
    const value = l / 100 - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(value * 255)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${channel(0)}${channel(8)}${channel(4)}`;
};

const LIGHTNESS = [30, 40, 50, 60, 70, 80];

// Pages of shades, swiped sideways (spec 5.2): each page is a hue range, each row one hue from dark to light.
export const COLOR_PAGES: string[][][] = [
  [0, 12, 24, 36, 48],
  [60, 75, 90, 110, 130],
  [150, 165, 180, 195, 210],
  [220, 235, 250, 265, 280],
  [290, 305, 320, 335, 350],
].map((hues) => hues.map((hue) => LIGHTNESS.map((lightness) => hslToHex(hue, 70, lightness))));

// Greys and browns: low saturation, the same lightness steps.
COLOR_PAGES.push(
  [0, 20, 30, 200, 220].map((hue, index) =>
    LIGHTNESS.map((lightness) => hslToHex(hue, index === 0 ? 0 : 25, lightness))
  )
);

export const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
