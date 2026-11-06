import mongoose from "mongoose";

const { ObjectId } = mongoose.Schema.Types;

// i18n dictionary: one document per (lang, key), so a new language is just new rows.
const TranslationSchema = new mongoose.Schema(
  {
    lang: { type: String, required: true },
    key: { type: String, required: true },
    value: { type: String, required: true },
  },
  { timestamps: true, versionKey: false }
);
TranslationSchema.index({ lang: 1, key: 1 }, { unique: true });

// Latest USD-based rates; one document, overwritten daily.
const ExchangeRateSchema = new mongoose.Schema(
  {
    base: { type: String, required: true, unique: true },
    rates: { type: Map, of: Number, required: true },
    source: { type: String, default: "" },
    fetchedAt: { type: Date, required: true },
  },
  { versionKey: false }
);

const SupportMessageSchema = new mongoose.Schema(
  {
    userId: { type: ObjectId, ref: "User", required: true, index: true },
    subject: { type: String, required: true },
    message: { type: String, required: true },
    appVersion: { type: String, default: "" },
    device: { type: String, default: "" },
    screenshotPhotoId: { type: String, default: null },
    emailedAt: { type: Date, default: null },
  },
  { timestamps: true, versionKey: false }
);

const ONE_YEAR_S = 365 * 24 * 60 * 60;

// Login, logout, revocation, data deletion (spec 3.4). Kept for a year.
const SecurityEventSchema = new mongoose.Schema(
  {
    userId: { type: ObjectId, ref: "User", index: true },
    type: { type: String, required: true },
    sessionId: { type: ObjectId, default: null },
    ip: { type: String, default: "" },
    meta: { type: Object, default: undefined },
    createdAt: { type: Date, default: Date.now, expires: ONE_YEAR_S },
  },
  { versionKey: false }
);

export const TranslationModel = mongoose.model("Translation", TranslationSchema);
export const ExchangeRateModel = mongoose.model("ExchangeRate", ExchangeRateSchema);
export const SupportMessageModel = mongoose.model("SupportMessage", SupportMessageSchema);
export const SecurityEventModel = mongoose.model("SecurityEvent", SecurityEventSchema);
