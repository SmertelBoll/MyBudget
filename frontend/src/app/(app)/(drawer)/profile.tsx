import { useState } from "react";
import { View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { ApiError } from "@/api/client";
import { useAuth } from "@/auth/AuthProvider";
import { useI18n } from "@/i18n/I18nProvider";
import { AVATAR_ICON_SECTIONS } from "@/constants/appearance";
import { useTheme } from "@/theme/ThemeProvider";
import { KEYBOARD_GAP } from "@/utils/keyboard";
import { useBottomSpace } from "@/utils/useBottomSpace";
import { radius, spacing } from "@/theme/tokens";
import { AppText } from "@/components/AppText";
import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/Button";
import { useDialog } from "@/components/AppDialog";
import { ColorPicker } from "@/components/ColorPicker";
import { IconPicker } from "@/components/IconPicker";
import { TextField } from "@/components/TextField";
import { ScreenHeader } from "@/components/ScreenHeader";
import { useToast } from "@/components/Toast";

const DELETE_COUNTDOWN_S = 10;

// Screen 12: icon (from a set of icons and colors) and name are edited here; the email is not. Changes save with
// the button and wait for the connection when offline.
export default function ProfileScreen() {
  const { colors } = useTheme();
  const { t } = useI18n();
  const dialog = useDialog();
  const toast = useToast();
  const { user, signOut, deleteAccount, updateMe } = useAuth();
  const bottomSpace = useBottomSpace();
  const [deleting, setDeleting] = useState(false);
  const [draft, setDraft] = useState<{ name: string; icon: string; color: string } | null>(null);

  if (!user) return null;

  const values = draft ?? { name: user.name, icon: user.avatar.icon, color: user.avatar.color };
  const set = (patch: Partial<typeof values>) => setDraft({ ...values, ...patch });
  const changed = values.name.trim() !== user.name || values.icon !== user.avatar.icon || values.color !== user.avatar.color;
  const nameError = values.name.trim() ? undefined : t("common.required");

  const saveProfile = () => {
    if (nameError) return;
    updateMe({ name: values.name.trim(), avatar: { icon: values.icon, color: values.color } })
      .then(() => toast.show(t("profile.saved")))
      .catch((error) => toast.show(t(error instanceof ApiError ? error.code : "common.serverError"), { kind: "error" }));
    setDraft(null);
  };

  const logout = async () => {
    const ok = await dialog.confirm({ title: t("profile.logout"), message: t("profile.logoutConfirm"), confirmText: t("profile.logout") });
    if (ok) await signOut();
  };

  // Same two-step flow as account deletion in the spec (screen 5.3): confirm, then a 10 s countdown that deletes
  // unless "Don't delete" is pressed.
  const remove = async () => {
    const sure = await dialog.confirm({
      title: t("profile.deleteTitle"),
      message: t("profile.deleteMessage"),
      confirmText: t("profile.deleteAccount"),
      destructive: true,
    });
    if (!sure) return;
    const final = await dialog.confirm({
      title: t("profile.deleteFinalTitle"),
      message: t("profile.deleteFinalMessage"),
      cancelText: t("profile.keep"),
      destructive: true,
      countdown: { seconds: DELETE_COUNTDOWN_S, autoConfirm: true },
    });
    if (!final) return;

    setDeleting(true);
    try {
      await deleteAccount();
      toast.show(t("profile.deleted"));
    } catch (error) {
      toast.show(t(error instanceof ApiError ? error.code : "common.serverError"), { kind: "error" });
      setDeleting(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title={t("nav.profile")} />
      <KeyboardAwareScrollView bottomOffset={KEYBOARD_GAP} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: spacing.md, gap: spacing.lg, paddingBottom: bottomSpace }}>
        <View style={{ alignItems: "center", gap: spacing.sm, backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.lg }}>
          <Avatar icon={values.icon} color={values.color} size={88} />
          <AppText variant="title">{values.name.trim() || user.name}</AppText>
          <AppText secondary>{user.email}</AppText>
        </View>

        <View style={{ backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, gap: spacing.md }}>
          <TextField label={t("profile.name")} value={values.name} onChangeText={(name) => set({ name })} maxLength={50} error={draft ? nameError : undefined} />
          <IconPicker label={t("profile.icon")} sections={AVATAR_ICON_SECTIONS} value={values.icon} color={values.color} onChange={(icon) => set({ icon })} />
          <ColorPicker label={t("profile.color")} value={values.color} onChange={(color) => set({ color })} />
          {changed && <Button title={t("common.save")} icon="check" onPress={saveProfile} disabled={Boolean(nameError)} />}
        </View>

        <Button title={t("profile.logout")} icon="logout" variant="secondary" onPress={logout} />
        <Button title={t("profile.deleteAccount")} icon="delete-outline" variant="danger" onPress={remove} loading={deleting} />

        <AppText variant="caption" secondary selectable style={{ textAlign: "center" }}>
          {t("profile.accountId", { id: user.id })}
        </AppText>
      </KeyboardAwareScrollView>
    </View>
  );
}
