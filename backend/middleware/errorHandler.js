import multer from "multer";
import { AppError } from "../utils/AppError.js";

export const notFound = (req, res) => {
  res.status(404).json({ code: "common.notFound" });
};

// eslint-disable-next-line no-unused-vars
export const errorHandler = (err, req, res, next) => {
  // Photo uploads fail quietly on the phone (sync keeps going), so the reason is kept in the server log.
  if (req.method === "POST" && req.path.endsWith("/photos")) {
    console.warn(`photo upload failed: ${err.code || err.name} ${err.message || ""}`.trim());
  }
  if (err instanceof AppError) {
    return res.status(err.status).json({ code: err.code, ...(err.details && { details: err.details }) });
  }
  if (err instanceof multer.MulterError) {
    const tooLarge = err.code === "LIMIT_FILE_SIZE";
    return res.status(tooLarge ? 413 : 400).json({ code: tooLarge ? "photo.tooLarge" : "photo.invalidUpload" });
  }
  if (err.type === "entity.too.large") {
    return res.status(413).json({ code: "common.payloadTooLarge" });
  }
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ code: "common.invalidJson" });
  }
  console.error(err);
  res.status(500).json({ code: "common.serverError" });
};
