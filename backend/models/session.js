import mongoose from "mongoose";

// One signed-in device (spec 3.2-3.3).
const SessionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    refreshTokenHash: { type: String, required: true },
    // The token replaced by the last rotation. Seeing it again means it was stolen: the session is revoked.
    prevRefreshTokenHash: { type: String, default: null },
    deviceId: { type: String, default: "" },
    deviceName: { type: String, default: "" },
    platform: { type: String, default: "other" },
    appVersion: { type: String, default: "" },
    ip: { type: String, default: "" },
    location: { type: String, default: "" },
    lastActiveAt: { type: Date, default: Date.now },
    revokedAt: { type: Date, default: null },
    // logout | remote | reuse | expired
    revokeReason: { type: String, default: null },
  },
  { timestamps: true, versionKey: false }
);

SessionSchema.methods.toPublic = function (currentSessionId) {
  return {
    id: this._id,
    deviceName: this.deviceName,
    platform: this.platform,
    appVersion: this.appVersion,
    location: this.location,
    createdAt: this.createdAt,
    lastActiveAt: this.lastActiveAt,
    isCurrent: String(this._id) === String(currentSessionId),
  };
};

export default mongoose.model("Session", SessionSchema);
