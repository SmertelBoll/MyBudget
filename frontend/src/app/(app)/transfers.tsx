import { useMemo } from "react";
import { Pressable, SectionList, View } from "react-native";
import { router } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useCollection } from "@/data/hooks";
import type { Account, Transfer } from "@/data/types";
import { useI18n } from "@/i18n/I18nProvider";
import { useTheme } from "@/theme/ThemeProvider";
import { radius, spacing } from "@/theme/tokens";
import { useBottomSpace } from "@/utils/useBottomSpace";
import { addDays, formatLongDate, todayLocal } from "@/utils/dates";
import { useMoney } from "@/utils/useMoney";
import { AppText } from "@/components/AppText";
import { Fab } from "@/components/Fab";
import { IconCircle } from "@/components/IconCircle";
import { ScreenHeader } from "@/components/ScreenHeader";

// From above, to below (one arrow down on the left), and the amounts the same way on the right: account names get the full row width, and the
// row stays two text lines high.
function TransferRow({ transfer, from, to, onPress }: { transfer: Transfer; from?: Account; to?: Account; onPress: () => void }) {
  const { colors } = useTheme();
  const { money } = useMoney();
  const fromCurrency = from?.currency ?? to?.currency ?? "USD";
  const toCurrency = to?.currency ?? fromCurrency;
  const line = (account: Account | undefined) => (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
      <AppText numberOfLines={1} style={{ flexShrink: 1 }} color={account && !account.isActive ? colors.textSecondary : undefined}>
        {account?.name ?? "?"}
      </AppText>
      {account && !account.isActive && <MaterialCommunityIcons name="trash-can-outline" size={14} color={colors.textSecondary} />}
    </View>
  );

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: radius.md,
        backgroundColor: pressed ? colors.selected : colors.surface,
      })}
    >
      {/* One arrow from the top line (from) to the bottom one (to). */}
      <IconCircle icon="arrow-down" color={colors.iconIdle} size={36} />
      <View style={{ flex: 1, gap: 2 }}>
        {line(from)}
        {line(to)}
        {transfer.comment ? (
          <AppText variant="caption" secondary numberOfLines={1}>
            {transfer.comment}
          </AppText>
        ) : null}
      </View>
      <View style={{ alignItems: "flex-end", gap: 2 }}>
        <AppText variant="label" color={colors.textSecondary}>
          −{money(transfer.amountFrom, fromCurrency)}
        </AppText>
        <AppText variant="label">+{money(transfer.amountTo, toCurrency)}</AppText>
      </View>
    </Pressable>
  );
}

// Transfer history, newest first, grouped by day; a tap opens the transfer for editing (screen 10).
// The full logs screen with periods, search and export (screen 11) replaces this in a later stage.
export default function TransfersScreen() {
  const { colors } = useTheme();
  const bottomSpace = useBottomSpace();
  const { t, lang } = useI18n();
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
        contentContainerStyle={{ padding: spacing.md, gap: spacing.sm, paddingBottom: bottomSpace }}
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
        renderItem={({ item }) => (
          <TransferRow
            transfer={item}
            from={byId.get(item.fromAccountId)}
            to={byId.get(item.toAccountId)}
            onPress={() => router.push({ pathname: "/transfer/[id]", params: { id: item.id } })}
          />
        )}
      />
      <Fab label={t("accounts.newTransfer")} icon="plus" onPress={() => router.push({ pathname: "/transfer/[id]", params: { id: "new" } })} />
    </View>
  );
}
