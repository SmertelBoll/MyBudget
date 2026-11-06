import { v2 as cloudinary } from "cloudinary";
import { config } from "../config.js";

cloudinary.config({
  secure: true,
  cloud_name: config.cloudinary.cloudName,
  api_key: config.cloudinary.apiKey,
  api_secret: config.cloudinary.apiSecret,
});

export const isStorageConfigured = () =>
  Boolean(config.cloudinary.cloudName && config.cloudinary.apiKey && config.cloudinary.apiSecret);

export const userFolder = (userId) => `${config.cloudinary.folder}/${userId}`;

// Same Cloudinary setup as MovieList, but private: "authenticated" files are only reachable through a signed URL the
// backend hands out to the owner.
export const uploadPrivateImage = (buffer, { folder, publicId }) =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { type: "authenticated", resource_type: "image", folder, public_id: publicId, overwrite: false },
      (error, result) => (error ? reject(error) : resolve(result))
    );
    stream.end(buffer);
  });

export const signedImageUrl = (publicId, format, expiresAt) =>
  cloudinary.utils.private_download_url(publicId, format, {
    type: "authenticated",
    resource_type: "image",
    expires_at: Math.floor(expiresAt.getTime() / 1000),
  });

// Delete errors are only logged so a failed image removal never breaks the main operation (as in MovieList).
export const destroyImage = async (publicId) => {
  if (!publicId || !isStorageConfigured()) return;
  try {
    await cloudinary.uploader.destroy(publicId, { type: "authenticated", resource_type: "image", invalidate: true });
  } catch (error) {
    console.log("Cloudinary destroy error:", error);
  }
};

// Removes every photo of a user. The API deletes up to 1000 per call and reports `partial` while more remain.
export const destroyUserImages = async (userId) => {
  if (!isStorageConfigured()) return;
  try {
    for (let round = 0; round < 50; round += 1) {
      const result = await cloudinary.api.delete_resources_by_prefix(`${userFolder(userId)}/`, {
        type: "authenticated",
        resource_type: "image",
      });
      if (!result.partial) break;
    }
  } catch (error) {
    console.log("Cloudinary bulk destroy error:", error);
  }
};
