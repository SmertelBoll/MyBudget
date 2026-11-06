import mongoose from "mongoose";
import { syncedSchema } from "./syncedSchema.js";

const TransferSchema = syncedSchema({
  fromAccountId: { type: String, required: true },
  toAccountId: { type: String, required: true },
  // Minor units in each account's currency.
  amountFrom: { type: Number, required: true },
  amountTo: { type: Number, required: true },
  rate: { type: Number, required: true },
  date: { type: String, required: true },
  comment: { type: String, default: "" },
  clientCreatedAt: { type: Date, required: true },
});

export default mongoose.model("Transfer", TransferSchema);
