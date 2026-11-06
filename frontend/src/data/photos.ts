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
export const uploadPendingPhotos = async (): Promise<string | null> => {
  const pending = await (await getDb()).getAllAsync<{ id: string; uri: string }>("SELECT id, uri FROM photos WHERE uploaded = 0");
  let lastError: string | null = null;
  for (const { id, uri } of pending) {
    try {
      await api.post("/photos", await formFile(id, uri));
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
