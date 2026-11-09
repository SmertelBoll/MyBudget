import * as ImagePicker from "expo-image-picker";
import { useDialog } from "@/components/AppDialog";
import { useToast } from "@/components/Toast";
import { useI18n } from "@/i18n/I18nProvider";

export type PickedImage = { uri: string; width: number; height: number };

// Camera or gallery (asked in a dialog), with the permission. Resolves to null when the user backs out or refuses.
export const usePickImage = () => {
  const { t } = useI18n();
  const dialog = useDialog();
  const toast = useToast();
  return async (title: string): Promise<PickedImage | null> => {
    const source = await dialog.choose({
      title,
      options: [
        { value: "camera", label: t("photos.camera") },
        { value: "library", label: t("photos.library") },
      ],
    });
    if (!source) return null;
    const permission =
      source === "camera" ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      toast.show(t("photos.permissionDenied"), { kind: "error" });
      return null;
    }
    const options: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], quality: 1 };
    const result = source === "camera" ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
    const asset = result.canceled ? null : result.assets[0];
    return asset ? { uri: asset.uri, width: asset.width, height: asset.height } : null;
  };
};
