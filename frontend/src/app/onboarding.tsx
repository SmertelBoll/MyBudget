import { useEffect, useMemo, useRef, useState } from "react";
import { FlatList, ScrollView, View } from "react-native";
import { getLocales } from "expo-localization";
import { ApiError, api } from "@/api/client";
import { useAuth } from "@/auth/AuthProvider";
import { deviceLanguage, useI18n } from "@/i18n/I18nProvider";
import { LANGUAGES } from "@/i18n/languages";
import { useTheme } from "@/theme/ThemeProvider";
import { BOTTOM_ACTION_SPACE, radius, spacing } from "@/theme/tokens";
import { FALLBACK_CURRENCIES, currencyName } from "@/utils/currency";
import { AppText } from "@/components/AppText";
import { BottomActionButton } from "@/components/BottomActionButton";
import { OptionRow } from "@/components/OptionRow";
import { ScreenHeader } from "@/components/ScreenHeader";
import { TextField } from "@/components/TextField";
import { useToast } from "@/components/Toast";

// After the first sign-in (spec screen 1, 2.2): main currency and language. Then Home opens.
export default function OnboardingScreen() {
  const { colors } = useTheme();
  const { t, lang } = useI18n();
  const toast = useToast();
  const { user, updateMe } = useAuth();

  const [currencies, setCurrencies] = useState(FALLBACK_CURRENCIES);
  const [picked, setCurrency] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const languageGuessed = useRef(false);

  useEffect(() => {
    api
      .get<{ currencies: string[] }>("/currencies", { auth: false })
      .then((res) => setCurrencies(res.currencies))
      .catch(() => {});
  }, []);

  // The phone's currency and language are preselected: most people just press "Get started".
  const localCurrency = getLocales()[0]?.currencyCode ?? null;
  const currency = picked ?? (localCurrency && currencies.includes(localCurrency) ? localCurrency : null);

  useEffect(() => {
    if (languageGuessed.current || !user) return;
    languageGuessed.current = true;
    const guess = deviceLanguage();
    if (guess !== user.language) updateMe({ language: guess }).catch(() => {});
  }, [user, updateMe]);

  const items = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return currencies
      .map((code) => ({ code, name: currencyName(code, lang) }))
      .filter((item) => !needle || item.code.toLowerCase().includes(needle) || item.name.toLowerCase().includes(needle));
  }, [currencies, query, lang]);

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

      <FlatList
        data={items}
        keyExtractor={(item) => item.code}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: BOTTOM_ACTION_SPACE }}
        ListHeaderComponent={
          <View style={{ padding: spacing.md, gap: spacing.md }}>
            <AppText variant="heading">{t("onboarding.language")}</AppText>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
              {LANGUAGES.map((language) => {
                const active = language.code === user?.language;
                return (
                  <AppText
                    key={language.code}
                    onPress={() => updateMe({ language: language.code }).catch(() => {})}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active }}
                    variant="label"
                    color={active ? colors.onAccent : colors.text}
                    style={{
                      backgroundColor: active ? colors.accent : colors.surface,
                      borderRadius: radius.pill,
                      paddingHorizontal: spacing.md,
                      paddingVertical: spacing.sm,
                      overflow: "hidden",
                    }}
                  >
                    {language.nativeName}
                  </AppText>
                );
              })}
            </ScrollView>

            <AppText variant="heading" style={{ marginTop: spacing.sm }}>
              {t("onboarding.currency")}
            </AppText>
            <AppText variant="caption" secondary>
              {t("onboarding.currencyHint")}
            </AppText>
            <TextField
              label={t("onboarding.searchCurrency")}
              value={query}
              onChangeText={setQuery}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
        }
        renderItem={({ item }) => (
          <OptionRow
            title={item.code}
            subtitle={item.name === item.code ? undefined : item.name}
            selected={item.code === currency}
            onPress={() => setCurrency(item.code)}
          />
        )}
      />

      <BottomActionButton title={t("onboarding.start")} onPress={start} loading={saving} muted={!currency} />
    </View>
  );
}
