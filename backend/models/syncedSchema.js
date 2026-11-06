import mongoose from "mongoose";

// Fields every synced collection shares (spec 4.1, 5): a client-made string id so records can be created offline,
// the owner, the change number /sync/pull pages by, and the soft-delete mark.
export const syncedSchema = (definition) => {
  const schema = new mongoose.Schema(
    {
      _id: { type: String, required: true },
      userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
      seq: { type: Number, required: true },
      deletedAt: { type: Date, default: null },
      ...definition,
    },
    { timestamps: true, versionKey: false }
  );
  schema.index({ userId: 1, seq: 1 });
  return schema;
};
