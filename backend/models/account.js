import mongoose from "mongoose";
import { syncedSchema } from "./syncedSchema.js";

const AccountSchema = syncedSchema({
  name: { type: String, required: true },
  // Fixed at creation.
  currency: { type: String, required: true },
  icon: { type: String, required: true },
  color: { type: String, required: true },
  includeInTotal: { type: Boolean, default: true },
  note: { type: String, default: "" },
  // Balance = every transaction (balance corrections included) and transfer of the account. These two are what older
  // app versions counted from; now always 0 and the creation time (scripts/migrate-balance-corrections.js turned the
  // old ones into corrections).
  balanceAnchor: { type: Number, default: 0 },
  balanceAnchorAt: { type: Date, required: true },
  sortOrder: { type: Number, default: 0 },
  // false = "just remove from the list": its transactions stay and show the account dimmed.
  isActive: { type: Boolean, default: true },
});

export default mongoose.model("Account", AccountSchema);
