import jwt from "jsonwebtoken";
import { config } from "../config.js";
import { AppError } from "../utils/AppError.js";

export const checkAuth = (req, res, next) => {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) {
    throw new AppError(401, "auth.required");
  }

  try {
    const payload = jwt.verify(token, config.jwtAccessSecret, { algorithms: ["HS256"] });
    req.userId = payload.sub;
    req.sessionId = payload.sid;
  } catch (error) {
    // The client refreshes on tokenExpired and logs out on anything else.
    throw new AppError(401, error.name === "TokenExpiredError" ? "auth.tokenExpired" : "auth.invalidToken");
  }
  next();
};
