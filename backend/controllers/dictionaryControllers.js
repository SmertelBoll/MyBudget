import fs from "fs";
import { TranslationModel } from "../models/misc.js";
import { AppError } from "../utils/AppError.js";
import { DEFAULT_LANGUAGE, LANGUAGE_CODES, LANGUAGES } from "../utils/languages.js";
import { getLatestRates, refreshRates } from "../jobs/rates.js";

// Bundled English: served when the database has no dictionary yet (before scripts/seed-i18n.js has run).
const BUNDLED_EN = JSON.parse(fs.readFileSync(new URL("../i18n/en.json", import.meta.url), "utf8"));

export const getLanguages = (req, res) => {
  res.json({ languages: LANGUAGES, default: DEFAULT_LANGUAGE });
};

// The whole dictionary of one language. updatedAt lets the client skip re-downloading an unchanged one.
export const getTranslations = async (req, res) => {
  const { lang } = req.params;
  if (!LANGUAGE_CODES.includes(lang)) throw new AppError(404, "i18n.unknownLanguage");

  const rows = await TranslationModel.find({ lang }).select("key value updatedAt").lean();
  if (!rows.length && lang === DEFAULT_LANGUAGE) {
    return res.json({ lang, updatedAt: null, strings: BUNDLED_EN });
  }

  const strings = Object.fromEntries(rows.map((row) => [row.key, row.value]));
  const updatedAt = rows.reduce((latest, row) => (row.updatedAt > latest ? row.updatedAt : latest), new Date(0));
  res.set("Cache-Control", "public, max-age=3600");
  res.json({ lang, updatedAt: rows.length ? updatedAt : null, strings });
};

const loadRates = async () => {
  const rates = (await getLatestRates()) || (await refreshRates());
  if (!rates) throw new AppError(503, "rates.unavailable");
  return rates;
};

export const getRates = async (req, res) => {
  const { base, rates, fetchedAt } = await loadRates();
  res.set("Cache-Control", "public, max-age=3600");
  res.json({ base, rates, fetchedAt });
};

// Only currencies we have a rate for can be picked (spec 2.2). Names are localized on the client.
export const getCurrencies = async (req, res) => {
  const { rates } = await loadRates();
  res.set("Cache-Control", "public, max-age=3600");
  res.json({ currencies: Object.keys(rates).sort() });
};
