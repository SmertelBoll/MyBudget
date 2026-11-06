// Same list as backend/utils/languages.js (and the MovieList site). Native names are never translated.
export const LANGUAGES = [
  { code: "en", nativeName: "English" },
  { code: "uk", nativeName: "Українська" },
  { code: "de", nativeName: "Deutsch" },
  { code: "fr", nativeName: "Français" },
  { code: "es", nativeName: "Español" },
  { code: "it", nativeName: "Italiano" },
  { code: "pl", nativeName: "Polski" },
  { code: "pt", nativeName: "Português" },
  { code: "ja", nativeName: "日本語" },
  { code: "ko", nativeName: "한국어" },
  { code: "zh", nativeName: "中文" },
  { code: "tr", nativeName: "Türkçe" },
  { code: "ar", nativeName: "العربية" },
  { code: "hi", nativeName: "हिन्दी" },
  { code: "cs", nativeName: "Čeština" },
  { code: "da", nativeName: "Dansk" },
  { code: "el", nativeName: "Ελληνικά" },
  { code: "fi", nativeName: "Suomi" },
  { code: "hu", nativeName: "Magyar" },
  { code: "nl", nativeName: "Nederlands" },
  { code: "no", nativeName: "Norsk" },
  { code: "sv", nativeName: "Svenska" },
] as const;

export const DEFAULT_LANGUAGE = "en";

export const LANGUAGE_CODES: string[] = LANGUAGES.map((lang) => lang.code);
