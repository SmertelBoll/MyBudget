import { useMemo, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useBalances, useTotals } from "@/data/balances";
import { useCollection } from "@/data/hooks";
import { convert, useRates } from "@/data/rates";
import type { AccountFilter } from "@/data/stats";
import { useI18n } from "@/i18n/I18nProvider";
import { useTheme } from "@/theme/ThemeProvider";
import { radius, spacing } from "@/theme/tokens";
import { useMoney } from "@/utils/useMoney";
import { AppSheet } from "./AppSheet";
import { AppText } from "./AppText";
import { Button } from "./Button";
import { IconCircle } from "./IconCircle";

export const TOTAL_ICON = "sack";

// Balance of the chosen accounts in the main currency; Total is the "include in Total" sum (spec 2.1, Q3).
export const useFilterBalance = (filter: AccountFilter) => {
  const totals = useTotals();
  const balances = useBalances();
  const accounts = useCollection("accounts");
  const rates = useRates();
  return useMemo(() => {
    if (!filter) return totals.included;
    const chosen = new Set(filter);
    return accounts
      .filter((account) => chosen.has(account.id))
      .reduce((sum, account) => sum + (convert(balances.get(account.id) ?? 0, account.currency, totals.currency, rates) ?? 0), 0);
  }, [filter, totals, balances, accounts, rates]);
};

function Choice({ icon, color, title, subtitle, selected, highlight, onPress }: {
  icon: string;
  color: string;
  title: string;
  subtitle: string;
  selected: boolean;
  highlight?: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        padding: spacing.sm,
        borderRadius: radius.md,
        backgroundColor: pressed ? colors.selected : highlight ? colors.tonal : "transparent",
      })}
    >
      <MaterialCommunityIcons
        name={selected ? "checkbox-marked-circle" : "checkbox-blank-circle-outline"}
        size={24}
        color={selected ? colors.accent : colors.textSecondary}
      />
      <IconCircle icon={icon} color={color} size={40} />
      <View style={{ flex: 1 }}>
        <AppText variant="heading" numberOfLines={1}>
          {title}
        </AppText>
        <AppText variant="caption" secondary>
          {subtitle}
        </AppText>
      </View>
    </Pressable>
  );
}

// Spec 2.1: the "Total ▾" button in the header and its sheet. Several accounts can be chosen; picking Total clears
// them and picking an account clears Total.
export function AccountFilterSelect({
  value,
  onChange,
  showBalance,
  compact,
}: {
  value: AccountFilter;
  onChange: (filter: AccountFilter) => void;
  // Home shows the chosen accounts' balance under the name.
  showBalance?: boolean;
  // Smaller balance, for a lower header.
  compact?: boolean;
}) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const { money } = useMoney();
  const accounts = useCollection("accounts");
  const balances = useBalances();
  const totals = useTotals();
  const balance = useFilterBalance(value);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<AccountFilter>(value);

  const active = useMemo(() => [...accounts].filter((account) => account.isActive).sort((a, b) => a.sortOrder - b.sortOrder), [accounts]);
  // An account removed meanwhile drops out of the filter.
  const chosen = value?.map((id) => active.find((account) => account.id === id)).filter((account) => account !== undefined) ?? null;
  const single = chosen?.length === 1 ? chosen[0] : null;
  const title = !chosen?.length ? t("home.total") : single ? single.name : t("home.accounts", { count: chosen.length });

  const toggle = (id: string) =>
    setDraft((current) => {
      const next = new Set(current ?? []);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next.size ? [...next] : null;
    });

  return (
    <>
      <Pressable
        onPress={() => {
          setDraft(value);
          setOpen(true);
        }}
        accessibilityRole="button"
        accessibilityLabel={t("home.selectAccounts")}
        style={{ alignItems: "center" }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs, maxWidth: 240 }}>
          <MaterialCommunityIcons name={(single?.icon ?? TOTAL_ICON) as "sack"} size={22} color={colors.text} />
          <AppText variant="heading" numberOfLines={1} style={{ flexShrink: 1 }}>
            {title}
          </AppText>
          <MaterialCommunityIcons name="menu-down" size={22} color={colors.text} />
        </View>
        {showBalance && <AppText variant={compact ? "title" : "display"}>{money(balance, totals.currency)}</AppText>}
      </Pressable>

      <AppSheet visible={open} title={t("home.selectAccounts")} onClose={() => setOpen(false)}>
        <ScrollView style={{ maxHeight: 420 }} contentContainerStyle={{ gap: spacing.xs }}>
          <Choice
            icon={TOTAL_ICON}
            color={colors.accent}
            title={t("home.total")}
            subtitle={money(totals.included, totals.currency)}
            selected={!draft}
            highlight
            onPress={() => setDraft(null)}
          />
          {active.map((account) => (
            <Choice
              key={account.id}
              icon={account.icon}
              color={account.color}
              title={account.name}
              subtitle={money(balances.get(account.id) ?? 0, account.currency)}
              selected={Boolean(draft?.includes(account.id))}
              onPress={() => toggle(account.id)}
            />
          ))}
        </ScrollView>
        <View style={{ flexDirection: "row", gap: spacing.sm }}>
          <Button title={t("common.cancel")} variant="secondary" onPress={() => setOpen(false)} style={{ flex: 1 }} />
          <Button
            title={t("home.select")}
            onPress={() => {
              onChange(draft);
              setOpen(false);
            }}
            style={{ flex: 1 }}
          />
        </View>
      </AppSheet>
    </>
  );
}
