import mongoose from "mongoose";

// Repeat rule shared by regular payments and reminders (spec 8.3-8.4).
// kind "custom" uses either every + unit (+ weekdays for weeks) or a 5-field cron expression.
export const RuleSchema = new mongoose.Schema(
  {
    kind: {
      type: String,
      enum: ["once", "daily", "weekly", "monthly", "quarterly", "yearly", "custom"],
      required: true,
    },
    every: { type: Number },
    unit: { type: String, enum: ["day", "week", "month"] },
    weekdays: { type: [Number], default: undefined },
    cron: { type: String },
  },
  { _id: false }
);
