import type { SelectOption } from "@/components/SelectField";

// Same list as backend/utils/languages.js (and the MovieList site). Native names are never translated; the English
// name is shown under it and is searchable too.
export const LANGUAGES = [
  { code: "en", nativeName: "English", name: "English" },
  { code: "uk", nativeName: "Українська", name: "Ukrainian" },
  { code: "de", nativeName: "Deutsch", name: "German" },
  { code: "fr", nativeName: "Français", name: "French" },
  { code: "es", nativeName: "Español", name: "Spanish" },
  { code: "it", nativeName: "Italiano", name: "Italian" },
  { code: "pl", nativeName: "Polski", name: "Polish" },
  { code: "pt", nativeName: "Português", name: "Portuguese" },
  { code: "ja", nativeName: "日本語", name: "Japanese" },
  { code: "ko", nativeName: "한국어", name: "Korean" },
  { code: "zh", nativeName: "中文", name: "Chinese" },
  { code: "tr", nativeName: "Türkçe", name: "Turkish" },
  { code: "ar", nativeName: "العربية", name: "Arabic" },
  { code: "hi", nativeName: "हिन्दी", name: "Hindi" },
  { code: "cs", nativeName: "Čeština", name: "Czech" },
  { code: "da", nativeName: "Dansk", name: "Danish" },
  { code: "el", nativeName: "Ελληνικά", name: "Greek" },
  { code: "fi", nativeName: "Suomi", name: "Finnish" },
  { code: "hu", nativeName: "Magyar", name: "Hungarian" },
  { code: "nl", nativeName: "Nederlands", name: "Dutch" },
  { code: "no", nativeName: "Norsk", name: "Norwegian" },
  { code: "sv", nativeName: "Svenska", name: "Swedish" },
] as const;

export const DEFAULT_LANGUAGE = "en";

export const LANGUAGE_CODES: string[] = LANGUAGES.map((lang) => lang.code);

export const LANGUAGE_OPTIONS: SelectOption[] = LANGUAGES.map((lang) => ({
  value: lang.code,
  label: lang.nativeName,
  subtitle: lang.name === lang.nativeName ? undefined : lang.name,
}));
