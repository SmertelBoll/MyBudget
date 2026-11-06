import type { MaterialCommunityIcons } from "@expo/vector-icons";

// Spec 5.2: the allowed icons and colors for accounts and categories live in one place.

export type IconName = keyof typeof MaterialCommunityIcons.glyphMap;
export type IconSection = { title: string; icons: IconName[] };

// Section titles are dictionary keys. The first 7 icons are the ones shown inline (spec 5.2).
// The ruble sign is deliberately not offered.
export const ACCOUNT_ICON_SECTIONS: IconSection[] = [
  {
    title: "icons.money",
    icons: [
      "credit-card-outline", "cash", "bank", "piggy-bank", "wallet", "currency-uah", "safe",
      "credit-card", "credit-card-multiple-outline", "credit-card-chip-outline", "credit-card-wireless-outline",
      "contactless-payment", "cash-multiple", "cash-100", "cash-fast", "cash-lock", "bank-outline", "bank-transfer",
      "wallet-outline", "wallet-travel", "wallet-membership", "wallet-giftcard", "piggy-bank-outline",
      "safe-square-outline", "hand-coin", "hand-coin-outline", "account-cash", "sack", "sack-percent", "purse",
      "treasure-chest", "gift-outline", "cellphone-nfc", "qrcode-scan",
    ],
  },
  {
    title: "icons.currencies",
    icons: [
      "currency-uah", "currency-usd", "currency-eur", "currency-gbp", "currency-jpy", "currency-cny",
      "currency-inr", "currency-krw", "currency-try", "currency-kzt", "currency-ils",
    ],
  },
  {
    title: "icons.investments",
    icons: ["chart-line", "chart-areaspline", "finance", "trending-up", "gold", "diamond-stone", "bitcoin", "currency-btc", "ethereum", "currency-eth", "litecoin"],
  },
  {
    title: "icons.purposes",
    icons: [
      "home", "home-city", "car", "airplane", "school", "shield-check", "heart", "baby-face-outline",
      "account-group", "briefcase-outline", "store", "shopping", "cellphone",
    ],
  },
];

export const DEFAULT_ACCOUNT_ICON: IconName = "credit-card-outline";

// Spec 7.2: expense and income categories get different icon sets, many of them.
export const EXPENSE_ICON_SECTIONS: IconSection[] = [
  {
    title: "icons.food",
    icons: [
      "food", "cart", "basket", "coffee", "silverware-fork-knife", "hamburger", "pizza", "food-apple", "coffee-outline",
      "cup", "glass-wine", "glass-cocktail", "beer", "noodles", "cake-variant", "ice-cream", "bread-slice", "fish",
      "food-drumstick", "cupcake", "candy", "baguette", "food-croissant", "fruit-cherries", "carrot",
    ],
  },
  {
    title: "icons.shopping",
    icons: [
      "shopping", "shopping-outline", "tag-outline", "tshirt-crew", "shoe-sneaker", "shoe-heel", "hanger", "watch",
      "ring", "diamond-stone", "glasses", "sunglasses", "bag-personal", "lipstick",
    ],
  },
  {
    title: "icons.home",
    icons: [
      "home", "home-outline", "sofa", "bed", "lamp", "washing-machine", "fridge-outline", "tools", "hammer-wrench",
      "broom", "flower-outline", "lightbulb-outline", "water", "fire", "flash", "wifi", "phone", "cellphone", "television",
    ],
  },
  {
    title: "icons.transport",
    icons: [
      "bus", "car", "car-outline", "taxi", "train", "subway-variant", "airplane", "bike", "scooter", "motorbike",
      "gas-station", "parking", "car-wrench", "ferry",
    ],
  },
  {
    title: "icons.health",
    icons: [
      "medical-bag", "hospital-box", "pill", "heart-pulse", "tooth-outline", "dumbbell", "run", "spa",
      "face-woman-shimmer", "hair-dryer", "toothbrush", "lotion-outline",
    ],
  },
  {
    title: "icons.fun",
    icons: [
      "gamepad-variant", "movie-open", "music", "ticket", "party-popper", "palette", "book-open-variant", "camera",
      "beach", "tent", "soccer", "basketball", "dance-ballroom",
    ],
  },
  {
    title: "icons.familyEducation",
    icons: [
      "school", "book-education", "pencil", "laptop", "translate", "baby-carriage", "human-male-female-child", "paw",
      "dog", "cat", "gift", "heart", "account-group", "human-handsup",
    ],
  },
  {
    title: "icons.finance",
    icons: [
      "bank", "credit-card-outline", "cash", "percent", "receipt-text-outline", "file-document-outline",
      "shield-check-outline", "hand-heart", "charity", "calculator", "chart-line", "dots-horizontal", "star",
      "help-circle-outline",
    ],
  },
];

export const INCOME_ICON_SECTIONS: IconSection[] = [
  {
    title: "icons.work",
    icons: [
      "cash", "laptop", "briefcase", "briefcase-outline", "account-tie", "office-building", "handshake-outline",
      "cash-multiple", "store", "sale",
    ],
  },
  {
    title: "icons.investments",
    icons: ["chart-line", "finance", "bank", "piggy-bank", "percent", "cash-refund", "trending-up", "bitcoin", "gold", "home-city"],
  },
  {
    title: "icons.giftsOther",
    icons: ["gift", "hand-coin", "wallet-giftcard", "trophy-outline", "star", "heart", "dots-horizontal"],
  },
];

export const DEFAULT_CATEGORY_ICON: Record<"expense" | "income", IconName> = {
  expense: "shopping",
  income: "cash",
};

// Fill the quick rows under the form until the user has used enough colors of their own (spec 5.2).
export const QUICK_COLORS = [
  "#42a5f5", "#66bb6a", "#ffa726", "#ef5350", "#ab47bc", "#26a69a", "#8d6e63",
  "#ffca28", "#ec407a", "#5c6bc0", "#26c6da", "#9ccc65", "#78909c", "#ff7043",
];

// Two rows of seven.
export const QUICK_COLOR_COUNT = 14;

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
