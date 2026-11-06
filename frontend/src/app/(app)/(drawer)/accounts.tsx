import { useMemo, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { router } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { sortAccounts } from "@/data/accounts";
import { useBalances, useTotals } from "@/data/balances";
import { useCollection } from "@/data/hooks";
import { useI18n } from "@/i18n/I18nProvider";
import { useTheme } from "@/theme/ThemeProvider";
import { BOTTOM_ACTION_SPACE, radius, spacing } from "@/theme/tokens";
import { useMoney } from "@/utils/useMoney";
import { AppSheet } from "@/components/AppSheet";
import { AppText } from "@/components/AppText";
import { Fab } from "@/components/Fab";
import { ListRow } from "@/components/ListRow";
import { ScreenHeader } from "@/components/ScreenHeader";
import type { IconName } from "@/constants/appearance";

function ActionTile({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={{ flex: 1, alignItems: "center", gap: spacing.sm }}>
      {({ pressed }) => (
        <>
          <View
            style={{
              width: 64,
              height: 64,
              borderRadius: radius.md,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: pressed ? colors.accentPressed : colors.accent,
            }}
          >
            <MaterialCommunityIcons name={icon} size={32} color={colors.onAccent} />
          </View>
          <AppText variant="label" style={{ textAlign: "center" }}>
            {label}
          </AppText>
        </>
      )}
    </Pressable>
  );
}

// Screen 5.1.
export default function AccountsScreen() {
  const { colors } = useTheme();
  const { t } = useI18n();
  const { money } = useMoney();
  const accounts = useCollection("accounts");
  const balances = useBalances();
  const totals = useTotals();
  const [details, setDetails] = useState(false);

  const active = useMemo(() => sortAccounts(accounts.filter((account) => account.isActive)), [accounts]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title={t("nav.accounts")} />
      <ScrollView contentContainerStyle={{ padding: spacing.md, gap: spacing.md, paddingBottom: BOTTOM_ACTION_SPACE }}>
        <View style={{ alignItems: "center", gap: spacing.xs, paddingVertical: spacing.md }}>
          <AppText secondary>{t("accounts.total")}</AppText>
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
            <AppText variant="display">{money(totals.included, totals.currency)}</AppText>
            <Pressable
              onPress={() => setDetails(true)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t("accounts.balanceDetails")}
            >
              <MaterialCommunityIcons name="clipboard-text-outline" size={26} color={colors.textSecondary} />
            </Pressable>
          </View>
          {/* All money, including accounts kept out of Total (spec 5.1). */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
            <MaterialCommunityIcons name="cash-multiple" size={18} color={colors.textSecondary} />
            <AppText secondary accessibilityLabel={t("accounts.allMoney")}>
              {money(totals.all, totals.currency)}
            </AppText>
          </View>
        </View>

        <View style={{ flexDirection: "row", gap: spacing.md }}>
          <ActionTile icon="history" label={t("accounts.transferHistory")} onPress={() => router.push("/transfers")} />
          <ActionTile icon="swap-horizontal" label={t("accounts.newTransfer")} onPress={() => router.push({ pathname: "/transfer/[id]", params: { id: "new" } })} />
        </View>

        {active.length === 0 ? (
          <View style={{ alignItems: "center", gap: spacing.sm, paddingVertical: spacing.xl }}>
            <MaterialCommunityIcons name="wallet-plus-outline" size={48} color={colors.textSecondary} />
            <AppText variant="heading">{t("accounts.emptyTitle")}</AppText>
            <AppText secondary style={{ textAlign: "center" }}>
              {t("accounts.emptyHint")}
            </AppText>
          </View>
        ) : (
          <View style={{ gap: spacing.sm }}>
            {active.map((account) => (
              <ListRow
                key={account.id}
                icon={account.icon}
                color={account.color}
                title={account.name}
                note={account.note}
                value={money(balances.get(account.id) ?? 0, account.currency)}
                valueColor={(balances.get(account.id) ?? 0) < 0 ? colors.danger : undefined}
                badges={
                  !account.includeInTotal ? (
                    <MaterialCommunityIcons
                      name="eye-off-outline"
                      size={18}
                      color={colors.textSecondary}
                      accessibilityLabel={t("accounts.notInTotal")}
                    />
                  ) : undefined
                }
                onPress={() => router.push({ pathname: "/account/[id]", params: { id: account.id } })}
              />
            ))}
          </View>
        )}
      </ScrollView>

      <Fab label={t("accounts.new")} onPress={() => router.push({ pathname: "/account/[id]", params: { id: "new" } })} />

      <AppSheet visible={details} title={t("accounts.balanceDetails")} onClose={() => setDetails(false)}>
        <View style={{ gap: spacing.md }}>
          <View>
            <AppText secondary>{t("accounts.summary")}</AppText>
            <AppText variant="title">{money(totals.all, totals.currency, true)}</AppText>
          </View>
          <View>
            <AppText secondary>{t("accounts.included")}</AppText>
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
              <MaterialCommunityIcons name="eye-outline" size={20} color={colors.textSecondary} />
              <AppText variant="title">{money(totals.included, totals.currency, true)}</AppText>
            </View>
          </View>
          <View>
            <AppText secondary>{t("accounts.excluded")}</AppText>
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
              <MaterialCommunityIcons name="eye-off-outline" size={20} color={colors.textSecondary} />
              <AppText variant="title">{money(totals.excluded, totals.currency, true)}</AppText>
            </View>
          </View>
        </View>
      </AppSheet>
    </View>
  );
}
