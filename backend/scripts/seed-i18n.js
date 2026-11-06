// Loads i18n/<lang>.json files into the translations collection (spec 2.4, 10.1).
//   node scripts/seed-i18n.js          -> every file in i18n/
//   node scripts/seed-i18n.js uk de    -> only these languages
// To add a language: create i18n/<code>.json with the same keys as en.json and run this script. Missing keys fall
// back to English on the client. Keys no longer in the file are removed from the database.
import fs from "fs";
import mongoose from "mongoose";
import { assertConfig, config } from "../config.js";
import { TranslationModel } from "../models/misc.js";
import { LANGUAGE_CODES } from "../utils/languages.js";

const dir = new URL("../i18n/", import.meta.url);

assertConfig();
const requested = process.argv.slice(2);
const files = fs
  .readdirSync(dir)
  .filter((file) => file.endsWith(".json"))
  .map((file) => file.replace(/\.json$/, ""))
  .filter((lang) => !requested.length || requested.includes(lang));

const unknown = files.filter((lang) => !LANGUAGE_CODES.includes(lang));
if (unknown.length) {
  console.error(`Not in utils/languages.js: ${unknown.join(", ")}`);
  process.exit(1);
}

await mongoose.connect(config.mongoUri);

for (const lang of files) {
  const strings = JSON.parse(fs.readFileSync(new URL(`${lang}.json`, dir), "utf8"));
  const entries = Object.entries(strings);
  if (entries.length) {
    await TranslationModel.bulkWrite(
      entries.map(([key, value]) => ({
        updateOne: { filter: { lang, key }, update: { $set: { value } }, upsert: true },
      }))
    );
  }
  const removed = await TranslationModel.deleteMany({ lang, key: { $nin: Object.keys(strings) } });
  console.log(`${lang}: ${entries.length} keys, ${removed.deletedCount} removed`);
}

await mongoose.disconnect();
