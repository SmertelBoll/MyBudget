import mongoose from "mongoose";

// A transaction photo stored privately in Cloudinary. The id is made on the device, so a photo taken offline can be
// referenced by its transaction before it's uploaded.
const PhotoSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    publicId: { type: String, required: true },
    format: { type: String, required: true },
    bytes: { type: Number, default: 0 },
  },
  { timestamps: true, versionKey: false }
);

export default mongoose.model("Photo", PhotoSchema);
