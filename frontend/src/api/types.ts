import type { ThemeMode } from "@/theme/ThemeProvider";

export type Period = "day" | "week" | "month" | "year";
export type EntryType = "expense" | "income";

// Settings screen (spec 13); mirrors backend/models/user.js.
export type UserSettings = {
  homeAccount: string;
  defaultPeriod: Period;
  defaultAccountId: string | null;
  showComment: boolean;
  showPhotos: boolean;
  firstDayOfWeek: number;
  decimalSeparator: "." | ",";
  // The single switch before cents were split (it was for totals; entries always had cents): stands in for
  // centsInTotals until that is set.
  showCents: boolean;
  centsInEntries?: boolean | null;
  centsInHome?: boolean | null;
  centsInAccounts?: boolean | null;
  centsInTotals?: boolean | null;
  // Home-screen widgets; unset = with cents.
  centsInWidgets?: boolean | null;
  focus: EntryType;
  // Missing on users saved before it existed: shown.
  hideBalance?: boolean;
  receiptComments?: boolean;
};

export type User = {
  id: string;
  email: string;
  name: string;
  avatar: { icon: string; color: string };
  baseCurrency: string | null;
  language: string;
  theme: ThemeMode;
  onboarded: boolean;
  settings: UserSettings;
  dataEpoch: number;
  hasPassword: boolean;
  hasGoogle: boolean;
  createdAt: string;
};

export type UserPatch = Partial<Pick<User, "name" | "avatar" | "baseCurrency" | "language" | "theme" | "onboarded">> & {
  settings?: Partial<UserSettings>;
};

export type AuthPayload = {
  user: User;
  sessionId: string;
  accessToken: string;
  refreshToken: string;
};

export type DeviceInfo = {
  deviceId: string;
  deviceName: string;
  platform: "ios" | "android" | "web" | "other";
  appVersion: string;
};

export type Language = { code: string; name: string; nativeName: string };
