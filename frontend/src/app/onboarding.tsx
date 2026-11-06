import { useEffect, useRef, useState } from "react";
import { ScrollView, View } from "react-native";
import { getLocales } from "expo-localization";
import { ApiError } from "@/api/client";
import { useAuth } from "@/auth/AuthProvider";
import { deviceLanguage, useI18n } from "@/i18n/I18nProvider";
import { LANGUAGE_OPTIONS } from "@/i18n/languages";
import { useTheme } from "@/theme/ThemeProvider";
import { spacing } from "@/theme/tokens";
import { useBottomSpace } from "@/utils/useBottomSpace";
import { useCurrencyOptions, usePinnedCurrencies } from "@/utils/currency";
import { AppText } from "@/components/AppText";
import { BottomActionButton } from "@/components/BottomActionButton";
import { ScreenHeader } from "@/components/ScreenHeader";
import { SelectField } from "@/components/SelectField";
import { useToast } from "@/components/Toast";

// After the first sign-in (spec screen 1, 2.2): main currency and language. Then Home opens.
export default function OnboardingScreen() {
  const { colors } = useTheme();
  const bottomSpace = useBottomSpace();
  const { t } = useI18n();
  const toast = useToast();
  const { user, updateMe } = useAuth();

  const [picked, setCurrency] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const languageGuessed = useRef(false);

  const currencyOptions = useCurrencyOptions();
  const pinnedCurrencies = usePinnedCurrencies();

  // The phone's currency and language are preselected: most people just press "Get started".
  const localCurrency = getLocales()[0]?.currencyCode ?? null;
  const currency =
    picked ?? (localCurrency && currencyOptions.some((option) => option.value === localCurrency) ? localCurrency : null);

  useEffect(() => {
    if (languageGuessed.current || !user) return;
    languageGuessed.current = true;
    const guess = deviceLanguage();
    if (guess !== user.language) updateMe({ language: guess }).catch(() => {});
  }, [user, updateMe]);


  const start = async () => {
    if (!currency) {
      toast.show(t("onboarding.chooseCurrency"), { kind: "error" });
      return;
    }
    setSaving(true);
    try {
      await updateMe({ baseCurrency: currency, onboarded: true });
    } catch (error) {
      toast.show(t(error instanceof ApiError ? error.code : "common.serverError"), { kind: "error" });
      setSaving(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title={t("onboarding.title")} left="none">
        <AppText secondary style={{ paddingHorizontal: spacing.md, paddingBottom: spacing.sm }}>
          {t("onboarding.subtitle")}
        </AppText>
      </ScreenHeader>

      <ScrollView contentContainerStyle={{ padding: spacing.md, gap: spacing.lg, paddingBottom: bottomSpace }}>
        <SelectField
          label={t("onboarding.language")}
          value={user?.language ?? null}
          options={LANGUAGE_OPTIONS}
          onChange={(language) => updateMe({ language }).catch(() => {})}
        />

        <View style={{ gap: spacing.xs }}>
          <SelectField
            label={t("onboarding.currency")}
            value={currency}
            options={currencyOptions}
            pinned={pinnedCurrencies}
            onChange={setCurrency}
            placeholder={t("onboarding.chooseCurrency")}
            searchLabel={t("onboarding.searchCurrency")}
          />
          <AppText variant="caption" secondary>
            {t("onboarding.currencyHint")}
          </AppText>
        </View>
      </ScrollView>

      <BottomActionButton title={t("onboarding.start")} onPress={start} loading={saving} muted={!currency} />
    </View>
  );
}
