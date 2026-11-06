import { useMemo } from "react";
import { SectionList, View } from "react-native";
import { router } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useCollection } from "@/data/hooks";
import { useI18n } from "@/i18n/I18nProvider";
import { useTheme } from "@/theme/ThemeProvider";
import { BOTTOM_ACTION_SPACE, spacing } from "@/theme/tokens";
import { addDays, formatLongDate, todayLocal } from "@/utils/dates";
import { useMoney } from "@/utils/useMoney";
import { AppText } from "@/components/AppText";
import { Fab } from "@/components/Fab";
import { ListRow } from "@/components/ListRow";
import { ScreenHeader } from "@/components/ScreenHeader";

// Transfer history, newest first, grouped by day; a tap opens the transfer for editing (screen 10).
// The full logs screen with periods, search and export (screen 11) replaces this in a later stage.
export default function TransfersScreen() {
  const { colors } = useTheme();
  const { t, lang } = useI18n();
  const { money } = useMoney();
  const transfers = useCollection("transfers");
  const accounts = useCollection("accounts");

  const byId = useMemo(() => new Map(accounts.map((account) => [account.id, account])), [accounts]);
  const sections = useMemo(() => {
    const sorted = [...transfers].sort((a, b) => b.date.localeCompare(a.date) || b.clientCreatedAt.localeCompare(a.clientCreatedAt));
    const groups = new Map<string, typeof sorted>();
    for (const transfer of sorted) groups.set(transfer.date, [...(groups.get(transfer.date) ?? []), transfer]);
    return [...groups].map(([date, data]) => ({ date, data }));
  }, [transfers]);

  const today = todayLocal();
  const dayTitle = (date: string) => {
    const relative = date === today ? t("dates.today") : date === addDays(today, -1) ? t("dates.yesterday") : null;
    return relative ? `${relative}, ${formatLongDate(date, lang)}` : formatLongDate(date, lang);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title={t("accounts.transferHistory")} left="back" />
      <SectionList
        sections={sections}
        keyExtractor={(transfer) => transfer.id}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={{ padding: spacing.md, gap: spacing.sm, paddingBottom: BOTTOM_ACTION_SPACE }}
        ListEmptyComponent={
          <View style={{ alignItems: "center", gap: spacing.sm, paddingVertical: spacing.xl }}>
            <MaterialCommunityIcons name="swap-horizontal" size={48} color={colors.textSecondary} />
            <AppText secondary>{t("transfers.empty")}</AppText>
          </View>
        }
        renderSectionHeader={({ section }) => (
          <AppText variant="label" secondary style={{ marginTop: spacing.sm, textTransform: "capitalize" }}>
            {dayTitle(section.date)}
          </AppText>
        )}
        renderItem={({ item }) => {
          const from = byId.get(item.fromAccountId);
          const to = byId.get(item.toAccountId);
          const sameCurrency = from?.currency === to?.currency;
          return (
            <ListRow
              icon="swap-horizontal"
              color={colors.selected}
              title={`${from?.name ?? "?"} → ${to?.name ?? "?"}`}
              note={item.comment}
              value={
                sameCurrency || !from || !to
                  ? money(item.amountFrom, from?.currency ?? to?.currency ?? "USD")
                  : `${money(item.amountFrom, from.currency)} → ${money(item.amountTo, to.currency)}`
              }
              dimmed={Boolean((from && !from.isActive) || (to && !to.isActive))}
              onPress={() => router.push({ pathname: "/transfer/[id]", params: { id: item.id } })}
            />
          );
        }}
      />
      <Fab label={t("accounts.newTransfer")} icon="plus" onPress={() => router.push({ pathname: "/transfer/[id]", params: { id: "new" } })} />
    </View>
  );
}
