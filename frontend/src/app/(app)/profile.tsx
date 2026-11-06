import { useState } from "react";
import { ScrollView, View } from "react-native";
import { ApiError } from "@/api/client";
import { useAuth } from "@/auth/AuthProvider";
import { useI18n } from "@/i18n/I18nProvider";
import { useTheme } from "@/theme/ThemeProvider";
import { radius, spacing } from "@/theme/tokens";
import { AppText } from "@/components/AppText";
import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/Button";
import { useDialog } from "@/components/AppDialog";
import { ScreenHeader } from "@/components/ScreenHeader";
import { useToast } from "@/components/Toast";

const DELETE_COUNTDOWN_S = 10;

// Screen 12. Editing the name and avatar comes with the data phase; log out and account deletion work now.
export default function ProfileScreen() {
  const { colors } = useTheme();
  const { t } = useI18n();
  const dialog = useDialog();
  const toast = useToast();
  const { user, signOut, deleteAccount } = useAuth();
  const [deleting, setDeleting] = useState(false);

  if (!user) return null;

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
      <ScrollView contentContainerStyle={{ padding: spacing.md, gap: spacing.lg }}>
        <View style={{ alignItems: "center", gap: spacing.sm, backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.lg }}>
          <Avatar icon={user.avatar.icon} color={user.avatar.color} size={88} />
          <AppText variant="title">{user.name}</AppText>
          <AppText secondary>{user.email}</AppText>
        </View>

        <Button title={t("profile.logout")} icon="logout" variant="secondary" onPress={logout} />
        <Button title={t("profile.deleteAccount")} icon="delete-outline" variant="danger" onPress={remove} loading={deleting} />

        <AppText variant="caption" secondary selectable style={{ textAlign: "center" }}>
          {t("profile.accountId", { id: user.id })}
        </AppText>
      </ScrollView>
    </View>
  );
}
