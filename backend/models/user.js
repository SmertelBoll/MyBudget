import mongoose from "mongoose";

const UserSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    // null for accounts created through Google only
    passwordHash: { type: String, default: null },
    googleId: { type: String, unique: true, sparse: true },
    name: { type: String, default: "" },
    avatar: {
      icon: { type: String, default: "account" },
      color: { type: String, default: "#ffeb3b" },
    },
    // null until onboarding picks it
    baseCurrency: { type: String, default: null },
    language: { type: String, default: "en" },
    theme: { type: String, enum: ["system", "light", "dark"], default: "system" },
    onboarded: { type: Boolean, default: false },
    // Screen 13 of the spec.
    settings: {
      // "total" or an account id
      homeAccount: { type: String, default: "total" },
      defaultPeriod: { type: String, enum: ["day", "week", "month", "year"], default: "week" },
      defaultAccountId: { type: String, default: null },
      showComment: { type: Boolean, default: true },
      showPhotos: { type: Boolean, default: true },
      // 0 = Sunday ... 6 = Saturday
      firstDayOfWeek: { type: Number, default: 1 },
      decimalSeparator: { type: String, enum: [".", ","], default: "." },
      // The one switch before cents were split (for totals; entries always had cents). Unset (null), the Cents switches
      // below fall back to it (entries to "with cents").
      showCents: { type: Boolean, default: false },
      centsInEntries: { type: Boolean, default: null },
      centsInHome: { type: Boolean, default: null },
      centsInAccounts: { type: Boolean, default: null },
      centsInTotals: { type: Boolean, default: null },
      focus: { type: String, enum: ["expense", "income"], default: "expense" },
      // Home shows dots instead of the balance until the eye next to it is tapped.
      hideBalance: { type: Boolean, default: false },
      // Receipt scanning: fill each entry's comment with the item and the store (the switch on that screen starts here).
      receiptComments: { type: Boolean, default: false },
    },
    // Change counter: every synced write takes the next value, /sync/pull returns everything above the client's
    // cursor.
    syncSeq: { type: Number, default: 0 },
    // Bumped by "delete all data": a client with an older epoch wipes its local copy and pulls from scratch.
    dataEpoch: { type: Number, default: 0 },
    failedLogins: { type: Number, default: 0 },
    lockedUntil: { type: Date, default: null },
  },
  { timestamps: true, versionKey: false }
);

// Everything the client may see. Never spread the document itself: it carries passwordHash.
UserSchema.methods.toPublic = function () {
  return {
    id: this._id,
    email: this.email,
    name: this.name,
    avatar: this.avatar,
    baseCurrency: this.baseCurrency,
    language: this.language,
    theme: this.theme,
    onboarded: this.onboarded,
    settings: this.settings,
    dataEpoch: this.dataEpoch,
    hasPassword: Boolean(this.passwordHash),
    hasGoogle: Boolean(this.googleId),
    createdAt: this.createdAt,
  };
};

export default mongoose.model("User", UserSchema);
