import { useEffect, useState } from "react";
import { ActivityIndicator, Image, Pressable, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { MAX_PHOTOS, addPhoto, photoSource } from "@/data/photos";
import { useI18n } from "@/i18n/I18nProvider";
import { useTheme } from "@/theme/ThemeProvider";
import { radius, spacing } from "@/theme/tokens";
import { useDialog } from "../AppDialog";
import { AppText } from "../AppText";
import { useToast } from "../Toast";

const SIZE = 96;

function Thumb({ id, onRemove }: { id: string; onRemove: () => void }) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const [uri, setUri] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    photoSource(id)
      .then((source) => !cancelled && setUri(source))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [id]);

  return (
    <View style={{ width: SIZE, height: SIZE, borderRadius: radius.md, overflow: "hidden", backgroundColor: colors.surface }}>
      {uri ? (
        <Image source={{ uri }} style={{ width: SIZE, height: SIZE }} accessibilityIgnoresInvertColors />
      ) : (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <MaterialCommunityIcons name="image-outline" size={28} color={colors.textSecondary} />
        </View>
      )}
      <Pressable
        onPress={onRemove}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel={t("photos.remove")}
        style={{
          position: "absolute",
          top: 4,
          right: 4,
          width: 26,
          height: 26,
          borderRadius: 13,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.scrim,
        }}
      >
        <MaterialCommunityIcons name="close" size={16} color="#FFFFFF" />
      </Pressable>
    </View>
  );
}

// Spec 2.10, 4.6: up to 3 photos from the camera or the gallery, compressed before they're kept.
export function PhotoStrip({ value, onChange }: { value: string[]; onChange: (photoIds: string[]) => void }) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const dialog = useDialog();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const pick = async () => {
    const source = await dialog.choose({
      title: t("photos.add"),
      options: [
        { value: "camera", label: t("photos.camera") },
        { value: "library", label: t("photos.library") },
      ],
    });
    if (!source) return;

    const permission =
      source === "camera" ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      toast.show(t("photos.permissionDenied"), { kind: "error" });
      return;
    }
    const options: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], quality: 1 };
    const result = source === "camera" ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
    const asset = result.canceled ? null : result.assets[0];
    if (!asset) return;

    setBusy(true);
    try {
      const id = await addPhoto({ uri: asset.uri, width: asset.width, height: asset.height });
      onChange([...value, id]);
    } catch (error) {
      console.error("photo failed:", error);
      toast.show(t("photos.failed"), { kind: "error" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ gap: spacing.xs }}>
      <AppText variant="label">{t("photos.title")}</AppText>
      <View style={{ flexDirection: "row", gap: spacing.sm }}>
        {value.map((id) => (
          <Thumb key={id} id={id} onRemove={() => onChange(value.filter((photoId) => photoId !== id))} />
        ))}
        {value.length < MAX_PHOTOS && (
          <Pressable
            onPress={pick}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel={t("photos.add")}
            style={({ pressed }) => ({
              width: SIZE,
              height: SIZE,
              borderRadius: radius.md,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: pressed ? colors.selected : colors.tonal,
            })}
          >
            {busy ? <ActivityIndicator color={colors.text} /> : <MaterialCommunityIcons name="camera-plus-outline" size={30} color={colors.text} />}
          </Pressable>
        )}
      </View>
    </View>
  );
}
