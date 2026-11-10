import mongoose from "mongoose";
import { syncedSchema } from "./syncedSchema.js";

// Amounts are integers in minor units (cents). amount is in the entered currency, accountAmount in the account's;
// rate is the one used at entry, so old balances never move when rates change (spec 2.2).
const TransactionSchema = syncedSchema({
  type: { type: String, enum: ["expense", "income"], required: true },
  accountId: { type: String, required: true },
  // null only on a balance correction.
  categoryId: { type: String, default: null },
  tagIds: { type: [String], default: [] },
  amount: { type: Number, required: true },
  currency: { type: String, required: true },
  accountAmount: { type: Number, required: true },
  rate: { type: Number, required: true },
  // The user's local date, YYYY-MM-DD.
  date: { type: String, required: true },
  comment: { type: String, default: "" },
  // Photo ids, up to 3.
  photos: { type: [String], default: [] },
  // A balance correction: made when the user types an account balance by hand (or for an account's starting
  // balance). It moves the balance only: no category or tags, and it never shows in lists or statistics.
  isCorrection: { type: Boolean, default: false },
  // Set when generated from a regular payment.
  recurringId: { type: String, default: null },
  // When the record was made on the device (UTC); the server's createdAt would be the sync time instead.
  clientCreatedAt: { type: Date, required: true },
});

TransactionSchema.index({ userId: 1, date: 1 });

export default mongoose.model("Transaction", TransactionSchema);
