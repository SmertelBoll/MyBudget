import mongoose from "mongoose";
import { syncedSchema } from "./syncedSchema.js";
import { RuleSchema } from "./rule.js";

const ReminderSchema = syncedSchema({
  title: { type: String, required: true },
  rule: { type: RuleSchema, required: true },
  startDate: { type: String, required: true },
  time: { type: String, required: true },
  comment: { type: String, default: "" },
  active: { type: Boolean, default: true },
});

export default mongoose.model("Reminder", ReminderSchema);
