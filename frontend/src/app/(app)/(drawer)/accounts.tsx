import { useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import { ScrollView } from "react-native-gesture-handler";
import { router } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { sortAccounts } from "@/data/accounts";
import { useBalances, useTotals } from "@/data/balances";
import { useCollection } from "@/data/hooks";
import { applyOrder } from "@/data/ordering";
import { reportWriteError } from "@/data/store";
import { useI18n } from "@/i18n/I18nProvider";
import { useTheme } from "@/theme/ThemeProvider";
import { radius, spacing } from "@/theme/tokens";
import { useBottomSpace } from "@/utils/useBottomSpace";
import { useMoney } from "@/utils/useMoney";
import { AppSheet } from "@/components/AppSheet";
import { AppText } from "@/components/AppText";
import { Fab } from "@/components/Fab";
import { IconButton } from "@/components/IconButton";
import { ListRow } from "@/components/ListRow";
import { Reorderable } from "@/components/Reorderable";
import { ScreenHeader } from "@/components/ScreenHeader";
import type { IconName } from "@/constants/appearance";

// Square yellow icon with the label under it, as on the reference screenshot (screen 5.1).
function ActionButton({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={{ flex: 1, alignItems: "center", gap: spacing.xs }}>
      {({ pressed }) => (
        <>
          <View
            style={{
              width: 56,
              height: 56,
              borderRadius: radius.md,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: pressed ? colors.accentPressed : colors.accent,
            }}
          >
            <MaterialCommunityIcons name={icon} size={28} color={colors.onAccent} />
          </View>
          <AppText variant="label" style={{ textAlign: "center" }} numberOfLines={1}>
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
  const bottomSpace = useBottomSpace();
  const { t } = useI18n();
  const { money } = useMoney();
  const accounts = useCollection("accounts");
  const balances = useBalances();
  const totals = useTotals();
  const [details, setDetails] = useState(false);
  const [dragging, setDragging] = useState(false);

  const active = useMemo(() => sortAccounts(accounts.filter((account) => account.isActive)), [accounts]);


  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title={t("nav.accounts")} />
      <ScrollView scrollEnabled={!dragging} contentContainerStyle={{ padding: spacing.md, gap: spacing.md, paddingBottom: bottomSpace }}>
        <View style={{ alignItems: "center", gap: 2 }}>
          <AppText variant="caption" secondary>
            {t("accounts.total")}
          </AppText>
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
            <AppText variant="display">{money(totals.included, totals.currency, "accounts")}</AppText>
            <IconButton icon="clipboard-text-outline" label={t("accounts.balanceDetails")} size={36} onPress={() => setDetails(true)} />
          </View>
          {/* All money, including accounts kept out of Total (spec 5.1). */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
            <MaterialCommunityIcons name="cash-multiple" size={18} color={colors.textSecondary} />
            <AppText secondary accessibilityLabel={t("accounts.allMoney")}>
              {money(totals.all, totals.currency, "accounts")}
            </AppText>
          </View>
        </View>

        <View style={{ flexDirection: "row", gap: spacing.sm }}>
          <ActionButton icon="history" label={t("accounts.transferHistory")} onPress={() => router.push("/transfers")} />
          <ActionButton icon="swap-horizontal" label={t("accounts.newTransfer")} onPress={() => router.push({ pathname: "/transfer/[id]", params: { id: "new" } })} />
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
          // Long press and drag to put an account elsewhere (spec 5.1).
          <Reorderable
            items={active}
            keyOf={(account) => account.id}
            style={{ gap: spacing.sm }}
            onDragChange={setDragging}
            onReorder={(keys) => applyOrder("accounts", active, keys).catch(reportWriteError)}
            renderItem={(account) => (
              <ListRow
                icon={account.icon}
                color={account.color}
                title={account.name}
                note={account.note}
                value={money(balances.get(account.id) ?? 0, account.currency, "accounts")}
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
            )}
          />
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
