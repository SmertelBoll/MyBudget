import { Platform } from "react-native";
import { Directory, File, Paths } from "expo-file-system";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { ApiError, api } from "@/api/client";
import { newId } from "./accounts";
import { getDb, serialWrite } from "./db";

// Spec 2.10: up to 3 photos per transaction, compressed on the device (long side 1600 px, JPEG ~75 %), kept locally
// and uploaded to the server's private storage during sync. A transaction only stores photo ids.

export const MAX_PHOTOS = 3;
const LONG_SIDE = 1600;
const QUALITY = 0.75;
const URL_MARGIN_MS = 5 * 60 * 1000;

const photosDir = () => new Directory(Paths.document, "photos");

// Compresses a picked image and keeps it under a new photo id. Returns the id.
export const addPhoto = async (source: { uri: string; width: number; height: number }) => {
  const id = newId();
  const landscape = source.width >= source.height;
  const tooBig = Math.max(source.width, source.height) > LONG_SIDE;
  const context = ImageManipulator.manipulate(source.uri);
  if (tooBig) context.resize(landscape ? { width: LONG_SIDE } : { height: LONG_SIDE });
  const image = await context.renderAsync();
  const saved = await image.saveAsync({ compress: QUALITY, format: SaveFormat.JPEG });

  let uri = saved.uri;
  // On the phone the result sits in a cache folder the system may clear: move it next to the app's data.
  // (In the browser preview it's an in-memory blob URL and stays as it is.)
  if (Platform.OS !== "web") {
    const dir = photosDir();
    if (!dir.exists) dir.create({ intermediates: true });
    const target = new File(dir, `${id}.jpg`);
    new File(saved.uri).moveSync(target);
    uri = target.uri;
  }

  await serialWrite((db) => db.runAsync("INSERT OR REPLACE INTO photos (id, uri, uploaded) VALUES (?, ?, 0)", id, uri));
  return id;
};

const localUri = async (id: string) =>
  (await (await getDb()).getFirstAsync<{ uri: string }>("SELECT uri FROM photos WHERE id = ?", id))?.uri ?? null;

const signedUrls = new Map<string, { url: string; expiresAt: number }>();

// Where to show a photo from: the local file when this device has it, otherwise a short-lived signed URL.
export const photoSource = async (id: string) => {
  const local = await localUri(id);
  if (local) return local;
  const cached = signedUrls.get(id);
  if (cached && cached.expiresAt - URL_MARGIN_MS > Date.now()) return cached.url;
  const { url, expiresAt } = await api.get<{ url: string; expiresAt: string }>(`/photos/${id}`);
  signedUrls.set(id, { url, expiresAt: Date.parse(expiresAt) });
  return url;
};

const formFile = async (id: string, uri: string) => {
  const form = new FormData();
  form.append("id", id);
  if (Platform.OS === "web") {
    form.append("photo", await (await fetch(uri)).blob(), `${id}.jpg`);
  } else {
    // Expo's fetch (the global one since SDK 52) rejects React Native's { uri, name, type } descriptor; a file-system
    // File implements Blob and is read straight from disk. The file is saved as <id>.jpg, so name and type are right.
    form.append("photo", new File(uri));
  }
  return form;
};

// Called by sync before the outbox goes up. Re-sending an id is harmless (the server returns the existing photo).
// Never throws: a photo that fails stays pending for the next sync, and the transactions still go up (they show a
// placeholder elsewhere until the photo arrives). Returns the last error code, or null when everything went up.
const PHOTO_TIMEOUT_MS = 60_000;

export const uploadPendingPhotos = async (): Promise<string | null> => {
  const pending = await (await getDb()).getAllAsync<{ id: string; uri: string }>("SELECT id, uri FROM photos WHERE uploaded = 0");
  let lastError: string | null = null;
  for (const { id, uri } of pending) {
    try {
      // A photo over mobile data can take longer than an ordinary request; re-sending is harmless.
      await api.post("/photos", await formFile(id, uri), { timeoutMs: PHOTO_TIMEOUT_MS, retry: true });
      await serialWrite((db) => db.runAsync("UPDATE photos SET uploaded = 1 WHERE id = ?", id));
    } catch (error) {
      lastError = error instanceof ApiError ? error.code : "photos.failed";
      console.warn(`photo ${id} not uploaded:`, error instanceof ApiError ? `${error.status} ${error.code}` : error);
      // No storage on the server or no connection: the rest would fail the same way.
      if (error instanceof ApiError && (error.code === "photo.storageNotConfigured" || error.status === 0)) break;
    }
  }
  return lastError;
};

export const countPendingPhotos = async () =>
  (await (await getDb()).getFirstAsync<{ n: number }>("SELECT COUNT(*) AS n FROM photos WHERE uploaded = 0"))?.n ?? 0;

// A photo's file for a backup: from this device, or downloaded when it only lives on the server. Null when neither
// works (offline and never on this device).
export const photoBytes = async (id: string): Promise<Uint8Array | null> => {
  try {
    const local = await localUri(id);
    if (local && Platform.OS !== "web") {
      const file = new File(local);
      if (file.exists) return await file.bytes();
    }
    const source = local ?? (await photoSource(id));
    const response = await fetch(source);
    if (!response.ok) return null;
    return new Uint8Array(await response.arrayBuffer());
  } catch {
    return null;
  }
};

// A photo from a restored backup: kept on the device and uploaded by the next sync (re-sending an id the server
// already has is harmless).
export const storePhotoBytes = async (id: string, bytes: Uint8Array) => {
  let uri: string;
  if (Platform.OS === "web") {
    uri = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "image/jpeg" }));
  } else {
    const dir = photosDir();
    if (!dir.exists) dir.create({ intermediates: true });
    const file = new File(dir, `${id}.jpg`);
    if (file.exists) file.delete();
    file.create();
    await file.write(bytes);
    uri = file.uri;
  }
  await serialWrite((db) => db.runAsync("INSERT OR REPLACE INTO photos (id, uri, uploaded) VALUES (?, ?, 0)", id, uri));
};

// After the local data was wiped: the photo files go too.
export const deleteLocalPhotoFiles = () => {
  if (Platform.OS === "web") return;
  try {
    const dir = photosDir();
    if (dir.exists) dir.delete();
  } catch (error) {
    console.warn("photo files not deleted:", error);
  }
};
