import mongoose from "mongoose";
import { syncedSchema } from "./syncedSchema.js";

const CategorySchema = syncedSchema({
  // A default category has only nameKey and is translated on the client until the user renames it.
  name: { type: String, default: null },
  nameKey: { type: String, default: null },
  type: { type: String, enum: ["expense", "income"], required: true },
  icon: { type: String, required: true },
  color: { type: String, required: true },
  // Monthly limit in minor units of the user's base currency.
  plannedMonthly: { type: Number, default: null },
  sortOrder: { type: Number, default: 0 },
  // "Other": one per type, can't be deleted; deleted categories' transactions move here.
  isSystemOther: { type: Boolean, default: false },
  // Hidden: left out of the pickers and the main list; its entries keep it in history and statistics.
  hidden: { type: Boolean, default: false },
});

export default mongoose.model("Category", CategorySchema);
