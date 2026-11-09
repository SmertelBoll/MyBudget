import { Platform } from "react-native";
import { File, Paths } from "expo-file-system";
import * as DocumentPicker from "expo-document-picker";
import * as Sharing from "expo-sharing";

// Spec 13.4: backups and Excel files are made on the device. On the phone they go to the system share sheet (save to
// Files / Drive, send to a chat...); in the browser they download.
export const shareFile = async (name: string, bytes: Uint8Array, mimeType: string) => {
  if (Platform.OS === "web") {
    const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: mimeType }));
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    return;
  }
  const file = new File(Paths.cache, name);
  if (file.exists) file.delete();
  file.create();
  await file.write(bytes);
  await Sharing.shareAsync(file.uri, { mimeType, dialogTitle: name });
};

// The chosen file's bytes, or null when the user closed the picker.
export const pickFile = async (types: string[]): Promise<{ name: string; bytes: Uint8Array } | null> => {
  const result = await DocumentPicker.getDocumentAsync({ type: types, copyToCacheDirectory: true, multiple: false });
  if (result.canceled || !result.assets[0]) return null;
  const asset = result.assets[0];
  const bytes =
    Platform.OS === "web"
      ? new Uint8Array(await (asset.file ?? (await (await fetch(asset.uri)).blob())).arrayBuffer())
      : await new File(asset.uri).bytes();
  return { name: asset.name, bytes };
};

// "2026-11-09" for file names.
export const fileDate = () => {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
};
