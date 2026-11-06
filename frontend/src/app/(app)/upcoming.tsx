import { useMemo, useState } from "react";
import { Pressable, SectionList, View } from "react-native";
import { router } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { EntryType } from "@/api/types";
import { useAuth } from "@/auth/AuthProvider";
import { categoryName } from "@/data/categories";
import { useCollection } from "@/data/hooks";
import { convert, useRates } from "@/data/rates";
import type { Recurring } from "@/data/types";
import { useI18n } from "@/i18n/I18nProvider";
import { useTheme } from "@/theme/ThemeProvider";
import { radius, spacing } from "@/theme/tokens";
import { addDays, formatLongDate, parseLocalDate, toLocalDate, todayLocal } from "@/utils/dates";
import { formatPeriod, type PeriodRange } from "@/utils/periods";
import { occurrencesBetween, type Occurrence } from "@/utils/schedule";
import { useBottomSpace } from "@/utils/useBottomSpace";
import { useMoney } from "@/utils/useMoney";
import { AppSheet } from "@/components/AppSheet";
import { AppText } from "@/components/AppText";
import { IconButton } from "@/components/IconButton";
import { IconCircle } from "@/components/IconCircle";
import { PeriodSwitcher } from "@/components/PeriodSwitcher";
import { ScreenHeader } from "@/components/ScreenHeader";
import { SegmentedSwitch } from "@/components/SegmentedSwitch";

// From today to the same day next month, minus one day (15.09-14.10), as spec 8.1 describes.
const comingMonth = (): PeriodRange => {
  const today = todayLocal();
  const date = parseLocalDate(today);
  const sameDayNextMonth = toLocalDate(new Date(date.getFullYear(), date.getMonth() + 1, date.getDate(), 12));
  return { kind: "custom", start: today, end: addDays(sameDayNextMonth, -1) };
};

type Item = { payment: Recurring; occurrence: Occurrence; value: number };

// Screen 8.1 "Upcoming": every payment due in the period (all in the main currency), grouped by day, with a summary.
export default function UpcomingScreen() {
  const { colors } = useTheme();
  const { t, lang } = useI18n();
  const { money, baseCurrency } = useMoney();
  const { user } = useAuth();
  const rates = useRates();
  const bottomSpace = useBottomSpace();
  const payments = useCollection("recurring");
  const accounts = useCollection("accounts");
  const categories = useCollection("categories");

  const [type, setType] = useState<EntryType>(user?.settings.focus ?? "expense");
  const [range, setRange] = useState<PeriodRange>(comingMonth);
  const [summary, setSummary] = useState(false);

  const items = useMemo(() => {
    const all: Item[] = [];
    for (const payment of payments) {
      // Paused payments won't happen.
      if (payment.active === false) continue;
      const value = convert(payment.amount, payment.currency, baseCurrency, rates) ?? payment.amount;
      for (const occurrence of occurrencesBetween(payment, range.start, range.end)) all.push({ payment, occurrence, value });
    }
    return all.sort((a, b) => `${a.occurrence.date} ${a.occurrence.time}`.localeCompare(`${b.occurrence.date} ${b.occurrence.time}`));
  }, [payments, range, baseCurrency, rates]);

  const totals = useMemo(
    () => ({
      expense: items.filter((item) => item.payment.type === "expense").reduce((sum, item) => sum + item.value, 0),
      income: items.filter((item) => item.payment.type === "income").reduce((sum, item) => sum + item.value, 0),
    }),
    [items]
  );
  const sections = useMemo(() => {
    const groups = new Map<string, Item[]>();
    for (const item of items.filter((entry) => entry.payment.type === type)) {
      groups.set(item.occurrence.date, [...(groups.get(item.occurrence.date) ?? []), item]);
    }
    return [...groups].map(([date, data]) => ({ date, data }));
  }, [items, type]);

  const accountName = (id: string) => accounts.find((account) => account.id === id)?.name ?? "?";

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader
        title={t("recurring.upcoming")}
        left="back"
        right={<IconButton icon="clipboard-text-outline" label={t("recurring.upcomingTotal")} onPress={() => setSummary(true)} />}
      >
        <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.xs }}>
          <SegmentedSwitch
            options={[
              { value: "expense", label: t("entries.expenses") },
              { value: "income", label: t("entries.income") },
            ]}
            value={type}
            onChange={setType}
          />
        </View>
      </ScreenHeader>

      <SectionList
        sections={sections}
        keyExtractor={(item) => `${item.payment.id}-${item.occurrence.date}-${item.occurrence.time}`}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={{ padding: spacing.md, gap: spacing.sm, paddingBottom: bottomSpace }}
        ListHeaderComponent={
          <View style={{ gap: spacing.sm }}>
            <View style={{ backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.sm }}>
              <PeriodSwitcher value={range} onChange={setRange} allowFuture />
            </View>
            <AppText variant="heading">{t("logs.total", { amount: money(type === "expense" ? totals.expense : totals.income, baseCurrency, true) })}</AppText>
          </View>
        }
        ListEmptyComponent={
          <View style={{ alignItems: "center", gap: spacing.sm, paddingVertical: spacing.xl }}>
            <MaterialCommunityIcons name="calendar-check" size={48} color={colors.textSecondary} />
            <AppText secondary>{t("recurring.upcomingEmpty")}</AppText>
          </View>
        }
        renderSectionHeader={({ section }) => (
          <AppText variant="label" secondary style={{ marginTop: spacing.sm, textTransform: "capitalize" }}>
            {formatLongDate(section.date, lang)}
          </AppText>
        )}
        renderItem={({ item }) => {
          const category = categories.find((entry) => entry.id === item.payment.categoryId);
          return (
            <Pressable
              onPress={() => router.push({ pathname: "/recurring/[id]", params: { id: item.payment.id } })}
              accessibilityRole="button"
              style={({ pressed }) => ({ padding: spacing.md, gap: spacing.sm, borderRadius: radius.md, backgroundColor: pressed ? colors.selected : colors.surface })}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
                <MaterialCommunityIcons name="clock-outline" size={16} color={colors.textSecondary} />
                <AppText secondary numberOfLines={1} style={{ flex: 1 }}>
                  {item.payment.name}
                </AppText>
                <AppText variant="caption" secondary>
                  {item.occurrence.time}
                </AppText>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
                <IconCircle icon={category?.icon ?? "help"} color={category?.color ?? colors.iconIdle} size={44} />
                <View style={{ flex: 1 }}>
                  <AppText variant="heading" numberOfLines={1}>
                    {category ? categoryName(category, t) : "?"}
                  </AppText>
                  <AppText variant="caption" secondary numberOfLines={1}>
                    {accountName(item.payment.accountId)}
                  </AppText>
                </View>
                <AppText variant="heading">{money(item.value, baseCurrency, true)}</AppText>
              </View>
            </Pressable>
          );
        }}
      />

      <AppSheet visible={summary} title={t("recurring.upcomingTotal")} onClose={() => setSummary(false)}>
        <View style={{ gap: spacing.sm }}>
          <AppText secondary style={{ textTransform: "capitalize" }}>
            {t("recurring.upcomingPeriod", { period: formatPeriod(range, lang) })}
          </AppText>
          {[
            { label: t("entries.expenses"), value: totals.expense },
            { label: t("entries.income"), value: totals.income },
            { label: t("recurring.net"), value: totals.income - totals.expense },
          ].map((row) => (
            <View key={row.label} style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <AppText>{row.label}</AppText>
              <AppText variant="heading">{money(row.value, baseCurrency, true)}</AppText>
            </View>
          ))}
          <AppText variant="caption" secondary>
            {t("recurring.upcomingNote")}
          </AppText>
        </View>
      </AppSheet>
    </View>
  );
}
