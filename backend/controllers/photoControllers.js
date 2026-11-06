import crypto from "crypto";
import multer from "multer";
import PhotoModel from "../models/photo.js";
import { AppError } from "../utils/AppError.js";
import { isStorageConfigured, signedImageUrl, uploadPrivateImage, userFolder } from "../utils/cloudinary.js";

const MAX_BYTES = 5 * 1024 * 1024;
const URL_TTL_MS = 60 * 60 * 1000;
const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

export const photoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES, files: 1, fields: 2 },
}).single("photo");

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const HEIC_BRANDS = new Set(["heic", "heix", "hevc", "hevx", "mif1", "msf1"]);

// The type comes from the file's first bytes, not from its name or the client's Content-Type (spec 2.10).
export const detectImageType = (buffer) => {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "jpg";
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(PNG_SIGNATURE)) return "png";
  if (buffer.length >= 12 && buffer.toString("ascii", 4, 8) === "ftyp" && HEIC_BRANDS.has(buffer.toString("ascii", 8, 12))) {
    return "heic";
  }
  return null;
};

const toPublic = (photo) => ({ id: photo._id, format: photo.format, bytes: photo.bytes, createdAt: photo.createdAt });

// multipart: "photo" (the file) and optional "id" (made on the device, so a photo taken offline is uploaded under the
// id its transaction already points to). Re-sending the same id returns the existing photo.
export const uploadPhoto = async (req, res) => {
  if (!isStorageConfigured()) throw new AppError(503, "photo.storageNotConfigured");
  if (!req.file) throw new AppError(400, "photo.missing");

  const format = detectImageType(req.file.buffer);
  if (!format) throw new AppError(415, "photo.unsupportedType");

  const id = req.body?.id || crypto.randomUUID();
  if (!ID_PATTERN.test(id)) throw new AppError(400, "common.validation");

  const existing = await PhotoModel.findById(id);
  if (existing) {
    if (String(existing.userId) !== String(req.userId)) throw new AppError(403, "photo.forbidden");
    return res.json({ photo: toPublic(existing) });
  }

  const result = await uploadPrivateImage(req.file.buffer, { folder: userFolder(req.userId), publicId: id });
  const photo = await PhotoModel.create({
    _id: id,
    userId: req.userId,
    publicId: result.public_id,
    format: result.format || format,
    bytes: result.bytes || req.file.size,
  });
  res.status(201).json({ photo: toPublic(photo) });
};

// Owner only. Returns a signed URL that stops working after an hour.
export const getPhoto = async (req, res) => {
  if (!isStorageConfigured()) throw new AppError(503, "photo.storageNotConfigured");
  const photo = await PhotoModel.findOne({ _id: req.params.id, userId: req.userId });
  if (!photo) throw new AppError(404, "photo.notFound");

  const expiresAt = new Date(Date.now() + URL_TTL_MS);
  res.json({ id: photo._id, url: signedImageUrl(photo.publicId, photo.format, expiresAt), expiresAt });
};
