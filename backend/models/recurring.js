import mongoose from "mongoose";
import { syncedSchema } from "./syncedSchema.js";
import { RuleSchema } from "./rule.js";

// Regular payments. Transactions are generated on the device (works offline); a generated transaction's id is
// derived from (payment id + date), so two devices generating the same day can't create a duplicate.
const RecurringSchema = syncedSchema({
  type: { type: String, enum: ["expense", "income"], required: true },
  name: { type: String, required: true },
  rule: { type: RuleSchema, required: true },
  autoAdd: { type: Boolean, default: true },
  startDate: { type: String, required: true },
  // HH:mm, local time
  time: { type: String, required: true },
  endDate: { type: String, default: null },
  accountId: { type: String, required: true },
  categoryId: { type: String, required: true },
  amount: { type: Number, required: true },
  currency: { type: String, required: true },
  tagIds: { type: [String], default: [] },
  comment: { type: String, default: "" },
  notify: { type: Boolean, default: true },
  // Off: the payment is paused (no entries, confirmations or notifications).
  active: { type: Boolean, default: true },
  lastGeneratedAt: { type: String, default: null },
});

export default mongoose.model("Recurring", RecurringSchema, "recurring");
