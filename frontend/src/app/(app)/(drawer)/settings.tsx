import { useMemo, type ReactNode } from "react";
import { ScrollView, View } from "react-native";
import { router } from "expo-router";
import { ApiError } from "@/api/client";
import type { EntryType, Period, UserPatch, UserSettings } from "@/api/types";
import { useAuth } from "@/auth/AuthProvider";
import { useI18n } from "@/i18n/I18nProvider";
import { useLanguageOptions } from "@/i18n/languages";
import { useTheme, type ThemeMode } from "@/theme/ThemeProvider";
import { spacing } from "@/theme/tokens";
import { useCurrencyOptions, usePinnedCurrencies } from "@/utils/currency";
import { useBottomSpace } from "@/utils/useBottomSpace";
import { AppText } from "@/components/AppText";
import { ScreenHeader } from "@/components/ScreenHeader";
import { SegmentedSwitch } from "@/components/SegmentedSwitch";
import { SelectField } from "@/components/SelectField";
import { useToast } from "@/components/Toast";
import { ToggleRow } from "@/components/ToggleRow";
import { DataSection } from "@/components/settings/DataSection";
import { AccountSettingField, ChoiceField } from "@/components/settings/PickerFields";
import { SettingsCard, SettingsLink } from "@/components/settings/SettingsCard";

const THEMES: ThemeMode[] = ["system", "light", "dark"];
const PERIODS: Period[] = ["day", "week", "month", "year"];
// Monday first, as in the calendar.
const WEEKDAYS = [1, 2, 3, 4, 5, 6, 0];

const weekdayLong = (day: number, lang: string) => {
  try {
    // 2023-01-01 was a Sunday.
    return new Intl.DateTimeFormat(lang, { weekday: "long" }).format(new Date(2023, 0, 1 + day, 12));
  } catch {
    return String(day);
  }
};

function Labeled({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={{ gap: spacing.xs }}>
      <AppText variant="label">{label}</AppText>
      {children}
    </View>
  );
}

// Screen 13: Personalisation, Appearance, Advanced, Data and storage, Security and sessions.
export default function SettingsScreen() {
  const { colors } = useTheme();
  const { t, lang } = useI18n();
  const toast = useToast();
  const bottomSpace = useBottomSpace();
  const { user, updateMe } = useAuth();
  const currencyOptions = useCurrencyOptions();
  const pinnedCurrencies = usePinnedCurrencies();
  const languageOptions = useLanguageOptions(user?.language);

  const weekdayOptions = useMemo(() => WEEKDAYS.map((day) => ({ value: String(day), label: weekdayLong(day, lang) })), [lang]);

  if (!user) return null;
  const { settings } = user;

  const save = (patch: UserPatch) =>
    updateMe(patch).catch((error) => toast.show(t(error instanceof ApiError ? error.code : "common.serverError"), { kind: "error" }));
  const setSetting = <K extends keyof UserSettings>(key: K, value: UserSettings[K]) => save({ settings: { [key]: value } });


  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title={t("nav.settings")} />
      <ScrollView contentContainerStyle={{ padding: spacing.md, gap: spacing.lg, paddingBottom: bottomSpace }}>
        <SettingsCard title={t("settings.personalisation")}>
          <AccountSettingField
            label={t("settings.homeAccount")}
            value={settings.homeAccount}
            empty="total"
            onChange={(id) => setSetting("homeAccount", id ?? "total")}
          />
          <Labeled label={t("settings.defaultPeriod")}>
            <SegmentedSwitch
              options={PERIODS.map((value) => ({ value, label: t(`periods.${value}`) }))}
              value={settings.defaultPeriod}
              onChange={(value) => setSetting("defaultPeriod", value)}
            />
          </Labeled>
          <AccountSettingField
            label={t("settings.entryAccount")}
            value={settings.defaultAccountId}
            empty="none"
            onChange={(id) => setSetting("defaultAccountId", id)}
          />
          <SelectField
            label={t("settings.baseCurrency")}
            value={user.baseCurrency}
            options={currencyOptions}
            pinned={pinnedCurrencies}
            onChange={(baseCurrency) => save({ baseCurrency })}
          />
          <View>
            <ToggleRow label={t("settings.showComment")} value={settings.showComment} onChange={(value) => setSetting("showComment", value)} />
            <ToggleRow label={t("settings.showPhotos")} value={settings.showPhotos} onChange={(value) => setSetting("showPhotos", value)} />
            <AppText variant="caption" secondary>
              {t("settings.fieldsHint")}
            </AppText>
          </View>
        </SettingsCard>

        <SettingsCard title={t("settings.appearance")}>
          <SelectField label={t("settings.language")} value={user.language} options={languageOptions} onChange={(language) => save({ language })} />
          <Labeled label={t("settings.theme")}>
            <SegmentedSwitch
              options={THEMES.map((value) => ({ value, label: t(`settings.theme.${value}`) }))}
              value={user.theme}
              onChange={(theme) => save({ theme })}
            />
          </Labeled>
        </SettingsCard>

        <SettingsCard title={t("settings.advanced")}>
          <ChoiceField
            label={t("settings.firstDay")}
            value={String(settings.firstDayOfWeek)}
            options={weekdayOptions}
            onChange={(value) => setSetting("firstDayOfWeek", Number(value))}
          />
          <Labeled label={t("settings.decimalSeparator")}>
            <SegmentedSwitch<"." | ",">
              options={[
                { value: ".", label: t("settings.decimalDot") },
                { value: ",", label: t("settings.decimalComma") },
              ]}
              value={settings.decimalSeparator}
              onChange={(value) => setSetting("decimalSeparator", value)}
            />
          </Labeled>
          <ToggleRow label={t("settings.showCents")} value={settings.showCents} onChange={(value) => setSetting("showCents", value)} />
          <Labeled label={t("settings.focus")}>
            <SegmentedSwitch<EntryType>
              options={[
                { value: "expense", label: t("entries.expenses") },
                { value: "income", label: t("entries.income") },
              ]}
              value={settings.focus}
              onChange={(value) => setSetting("focus", value)}
            />
          </Labeled>
        </SettingsCard>

        <DataSection />

        <SettingsCard title={t("settings.security")}>
          <SettingsLink icon="cellphone-link" label={t("sessions.title")} hint={t("sessions.hint")} onPress={() => router.push("/sessions")} />
        </SettingsCard>
      </ScrollView>
    </View>
  );
}
