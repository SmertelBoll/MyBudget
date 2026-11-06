import { SecurityEventModel } from "../models/misc.js";

// Fire-and-forget: a logging failure must never fail the request it describes.
export const logSecurityEvent = (type, { userId, sessionId = null, req, meta } = {}) => {
  SecurityEventModel.create({ type, userId, sessionId, ip: req?.ip || "", meta }).catch((error) =>
    console.log("security log error:", error)
  );
};
