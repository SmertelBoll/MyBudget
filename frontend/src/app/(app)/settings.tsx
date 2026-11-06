import { ScrollView, View } from "react-native";
import { ApiError } from "@/api/client";
import type { UserPatch } from "@/api/types";
import { useAuth } from "@/auth/AuthProvider";
import { useI18n } from "@/i18n/I18nProvider";
import { LANGUAGE_OPTIONS } from "@/i18n/languages";
import { useTheme, type ThemeMode } from "@/theme/ThemeProvider";
import { radius, spacing } from "@/theme/tokens";
import { AppText } from "@/components/AppText";
import { ScreenHeader } from "@/components/ScreenHeader";
import { SegmentedSwitch } from "@/components/SegmentedSwitch";
import { SelectField } from "@/components/SelectField";
import { useToast } from "@/components/Toast";

const THEMES: ThemeMode[] = ["system", "light", "dark"];

// Screen 13. Only Appearance (13.2) so far; the other sections need the local data layer.
export default function SettingsScreen() {
  const { colors } = useTheme();
  const { t } = useI18n();
  const toast = useToast();
  const { user, updateMe } = useAuth();

  if (!user) return null;

  const save = (patch: UserPatch) =>
    updateMe(patch).catch((error) =>
      toast.show(t(error instanceof ApiError ? error.code : "common.serverError"), { kind: "error" })
    );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title={t("nav.settings")} />
      <ScrollView contentContainerStyle={{ padding: spacing.md, gap: spacing.md }}>
        <AppText variant="heading">{t("settings.appearance")}</AppText>

        <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm }}>
          <AppText variant="label" secondary>
            {t("settings.theme")}
          </AppText>
          <SegmentedSwitch
            options={THEMES.map((value) => ({ value, label: t(`settings.theme.${value}`) }))}
            value={user.theme}
            onChange={(theme) => save({ theme })}
          />
        </View>

        <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md }}>
          <SelectField
            label={t("settings.language")}
            value={user.language}
            options={LANGUAGE_OPTIONS}
            onChange={(language) => save({ language })}
          />
        </View>
      </ScrollView>
    </View>
  );
}
