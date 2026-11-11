import { useMemo, useState } from "react";
import { FlatList, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useBalances } from "@/data/balances";
import { useCollection } from "@/data/hooks";
import { sortAccounts } from "@/data/accounts";
import { useI18n } from "@/i18n/I18nProvider";
import { useTheme } from "@/theme/ThemeProvider";
import { radius, spacing } from "@/theme/tokens";
import { useMoney } from "@/utils/useMoney";
import { AppText } from "./AppText";
import { FullScreenModal } from "./FullScreenModal";
import { IconCircle } from "./IconCircle";
import { ListRow } from "./ListRow";

// Spec 2.9 AccountPicker: shows the chosen account with its balance; opens the list of active accounts.
export function AccountPicker({
  label,
  value,
  onChange,
  exclude,
  error,
}: {
  label: string;
  value: string | null;
  onChange: (accountId: string) => void;
  exclude?: string | null;
  error?: string;
}) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const { money } = useMoney();
  const accounts = useCollection("accounts");
  const balances = useBalances();
  const [open, setOpen] = useState(false);

  const selected = accounts.find((account) => account.id === value);
  const options = useMemo(
    () => sortAccounts(accounts.filter((account) => account.isActive && account.id !== exclude)),
    [accounts, exclude]
  );

  return (
    <View style={{ gap: spacing.xs }}>
      <AppText variant="label">{label}</AppText>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        style={({ pressed }) => ({
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.md,
          minHeight: 56,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          borderRadius: radius.md,
          borderWidth: 1.5,
          borderColor: error ? colors.danger : colors.selected,
          backgroundColor: pressed ? colors.selected : colors.surface,
        })}
      >
        {selected ? (
          <>
            <IconCircle icon={selected.icon} color={selected.color} size={36} dimmed={!selected.isActive} />
            <View style={{ flex: 1 }}>
              <AppText numberOfLines={1}>{selected.name}</AppText>
              <AppText variant="caption" secondary>
                {money(balances.get(selected.id) ?? 0, selected.currency, "accounts")}
              </AppText>
            </View>
            {!selected.isActive && <MaterialCommunityIcons name="trash-can-outline" size={18} color={colors.textSecondary} />}
          </>
        ) : (
          <AppText secondary style={{ flex: 1 }}>
            {t("accounts.notSelected")}
          </AppText>
        )}
        <MaterialCommunityIcons name="chevron-down" size={22} color={colors.textSecondary} />
      </Pressable>
      {error ? (
        <AppText variant="caption" color={colors.danger}>
          {error}
        </AppText>
      ) : null}

      <FullScreenModal visible={open} title={label} onClose={() => setOpen(false)}>
        <FlatList
          data={options}
          keyExtractor={(account) => account.id}
          contentContainerStyle={{ padding: spacing.md, gap: spacing.sm, paddingBottom: insets.bottom + spacing.lg }}
          ListEmptyComponent={
            <AppText secondary style={{ textAlign: "center", padding: spacing.lg }}>
              {t("accounts.noOther")}
            </AppText>
          }
          renderItem={({ item }) => (
            <ListRow
              icon={item.icon}
              color={item.color}
              title={item.name}
              note={item.note}
              value={money(balances.get(item.id) ?? 0, item.currency, "accounts")}
              onPress={() => {
                onChange(item.id);
                setOpen(false);
              }}
            />
          )}
        />
      </FullScreenModal>
    </View>
  );
}
