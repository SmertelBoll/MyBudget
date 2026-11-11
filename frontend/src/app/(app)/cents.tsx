import { ScrollView, View } from "react-native";
import { ApiError } from "@/api/client";
import type { UserSettings } from "@/api/types";
import { useAuth } from "@/auth/AuthProvider";
import { useI18n } from "@/i18n/I18nProvider";
import { useTheme } from "@/theme/ThemeProvider";
import { spacing } from "@/theme/tokens";
import { formatMoney } from "@/utils/money";
import { useBottomSpace } from "@/utils/useBottomSpace";
import { centsSettings, useMoney } from "@/utils/useMoney";
import { AppText } from "@/components/AppText";
import { ScreenHeader } from "@/components/ScreenHeader";
import { useToast } from "@/components/Toast";
import { ToggleRow } from "@/components/ToggleRow";
import { SettingsCard } from "@/components/settings/SettingsCard";

type CentsKey = "centsInEntries" | "centsInHome" | "centsInAccounts" | "centsInTotals";

const SWITCHES: { key: CentsKey; label: string; hint: string }[] = [
  { key: "centsInEntries", label: "cents.entries", hint: "cents.entriesHint" },
  { key: "centsInHome", label: "cents.home", hint: "cents.homeHint" },
  { key: "centsInAccounts", label: "cents.accounts", hint: "cents.accountsHint" },
  { key: "centsInTotals", label: "cents.totals", hint: "cents.totalsHint" },
];

const SAMPLE = 123456;

// Settings -> Cents: where amounts show cents, place by place. Balance details, receipts and amount fields always do.
export default function CentsScreen() {
  const { colors } = useTheme();
  const { t } = useI18n();
  const toast = useToast();
  const bottomSpace = useBottomSpace();
  const { user, updateMe } = useAuth();
  const { format, baseCurrency } = useMoney();
  if (!user) return null;
  const values = centsSettings(user.settings);

  const set = (key: CentsKey, value: boolean) =>
    updateMe({ settings: { [key]: value } as Partial<UserSettings> }).catch((error) =>
      toast.show(t(error instanceof ApiError ? error.code : "common.serverError"), { kind: "error" })
    );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title={t("cents.title")} left="back" />
      <ScrollView contentContainerStyle={{ padding: spacing.md, gap: spacing.lg, paddingBottom: bottomSpace }}>
        <SettingsCard title={t("cents.where")}>
          {SWITCHES.map(({ key, label, hint }) => (
            <View key={key} style={{ gap: 2 }}>
              <ToggleRow label={t(label)} value={values[key]} onChange={(value) => set(key, value)} />
              <AppText variant="caption" secondary>
                {`${t(hint)} · ${formatMoney(SAMPLE, baseCurrency, { ...format, centsInTotals: values[key] })}`}
              </AppText>
            </View>
          ))}
        </SettingsCard>
        <AppText variant="caption" secondary>
          {t("cents.always")}
        </AppText>
      </ScrollView>
    </View>
  );
}
