import mongoose from "mongoose";
import { syncedSchema } from "./syncedSchema.js";

const TagSchema = syncedSchema({
  name: { type: String, required: true },
  // Uniqueness is case-insensitive per user; checked on write (a unique index would also block soft-deleted names).
  nameLower: { type: String, required: true },
  color: { type: String, default: null },
  parentId: { type: String, default: null },
});

TagSchema.index({ userId: 1, nameLower: 1 });

export default mongoose.model("Tag", TagSchema);
