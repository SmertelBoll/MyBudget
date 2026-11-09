import { Platform } from "react-native";
import { Directory, File, Paths } from "expo-file-system";
import * as DocumentPicker from "expo-document-picker";
import * as Sharing from "expo-sharing";
import { readJson, writeJson } from "@/storage/json";

// Spec 13.4: backups and Excel files are made on the device. On Android they're saved into a folder the user picks
// (or sent through the share sheet); on iOS the share sheet has "Save to Files"; in the browser they download.

const LAST_FOLDER_KEY = "files.lastFolder";

const downloadInBrowser = (name: string, bytes: Uint8Array, mimeType: string) => {
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: mimeType }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
};

// The share sheet. It doesn't say whether the user sent the file anywhere or just closed it.
export const shareFile = async (name: string, bytes: Uint8Array, mimeType: string) => {
  if (Platform.OS === "web") return downloadInBrowser(name, bytes, mimeType);
  const file = new File(Paths.cache, name);
  if (file.exists) file.delete();
  file.create();
  await file.write(bytes);
  await Sharing.shareAsync(file.uri, { mimeType, dialogTitle: name });
};

// Saves into a folder on the device. Returns the folder's name, or null when the user closed the folder picker.
// Android only (and the browser, where it's a download); iOS saves through the share sheet.
export const saveFileToDevice = async (name: string, bytes: Uint8Array, mimeType: string): Promise<string | null> => {
  if (Platform.OS === "web") {
    downloadInBrowser(name, bytes, mimeType);
    return "Downloads";
  }
  let folder: Directory;
  try {
    // Opens where the user saved last time.
    folder = await Directory.pickDirectoryAsync((await readJson<string>(LAST_FOLDER_KEY)) ?? undefined);
  } catch {
    return null;
  }
  if (!folder) return null;
  await writeJson(LAST_FOLDER_KEY, folder.uri);
  // The system adds " (1)" when a file with this name is already there.
  const file = folder.createFile(name, mimeType);
  await file.write(bytes);
  return folder.name || decodeURIComponent(folder.uri.split("%3A").pop() ?? "");
};

export const canSaveToDevice = Platform.OS === "android" || Platform.OS === "web";

const fromBase64 = (base64: string) => {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
};

// A picked file's content. Tries the direct read first, then base64, then fetch: which one works depends on the
// provider the file came from (Downloads, Drive, a messenger...).
const readPicked = async (uri: string): Promise<Uint8Array> => {
  const errors: string[] = [];
  try {
    return await new File(uri).bytes();
  } catch (error) {
    errors.push(`bytes: ${String(error)}`);
  }
  try {
    return fromBase64(await new File(uri).base64());
  } catch (error) {
    errors.push(`base64: ${String(error)}`);
  }
  try {
    return new Uint8Array(await (await fetch(uri)).arrayBuffer());
  } catch (error) {
    errors.push(`fetch: ${String(error)}`);
  }
  throw new Error(`can't read ${uri}: ${errors.join("; ")}`);
};

// The chosen file's bytes, or null when the user closed the picker.
export const pickFile = async (types: string[]): Promise<{ name: string; bytes: Uint8Array } | null> => {
  const result = await DocumentPicker.getDocumentAsync({ type: types, copyToCacheDirectory: true, multiple: false });
  if (result.canceled || !result.assets[0]) return null;
  const asset = result.assets[0];
  const bytes =
    Platform.OS === "web"
      ? new Uint8Array(await (asset.file ?? (await (await fetch(asset.uri)).blob())).arrayBuffer())
      : await readPicked(asset.uri);
  return { name: asset.name, bytes };
};

// "2026-11-09" for file names.
export const fileDate = () => {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
};
