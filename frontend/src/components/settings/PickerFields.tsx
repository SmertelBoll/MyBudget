import { useMemo, useState, type ReactNode } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useBalances, useTotals } from "@/data/balances";
import { useCollection } from "@/data/hooks";
import { useI18n } from "@/i18n/I18nProvider";
import { useTheme } from "@/theme/ThemeProvider";
import { radius, spacing } from "@/theme/tokens";
import { useMoney } from "@/utils/useMoney";
import { Choice, TOTAL_ICON } from "../AccountFilterSelect";
import { AppSheet } from "../AppSheet";
import { AppText } from "../AppText";
import { useDialog } from "../AppDialog";
import { IconCircle } from "../IconCircle";

// The box of a settings field: label above, the value inside, a chevron.
function FieldBox({ label, onPress, children }: { label: string; onPress: () => void; children: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: spacing.xs }}>
      <AppText variant="label">{label}</AppText>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={label}
        style={({ pressed }) => ({
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.sm,
          minHeight: 48,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.xs,
          borderRadius: radius.md,
          borderWidth: 1.5,
          borderColor: colors.selected,
          backgroundColor: pressed ? colors.selected : colors.surface,
        })}
      >
        {children}
        <MaterialCommunityIcons name="chevron-down" size={22} color={colors.textSecondary} />
      </Pressable>
    </View>
  );
}

// A few fixed options (the days of the week): a dialog instead of a searchable list.
export function ChoiceField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  const dialog = useDialog();
  const current = options.find((option) => option.value === value);
  const open = async () => {
    const picked = await dialog.choose({ title: label, options, selected: value });
    if (picked !== null) onChange(picked);
  };
  return (
    <FieldBox label={label} onPress={open}>
      <AppText style={{ flex: 1, textTransform: "capitalize" }} numberOfLines={1}>
        {current?.label ?? ""}
      </AppText>
    </FieldBox>
  );
}

const NONE_ICON = "close-circle-outline";

// One account, chosen in the same sheet as the account filter on Home (spec 13.1). `empty` is the first row: Total
// (Home account) or "Not selected" (account for new entries).
export function AccountSettingField({
  label,
  value,
  empty,
  onChange,
}: {
  label: string;
  value: string | null;
  empty: "total" | "none";
  onChange: (accountId: string | null) => void;
}) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const { money } = useMoney();
  const accounts = useCollection("accounts");
  const balances = useBalances();
  const totals = useTotals();
  const [open, setOpen] = useState(false);

  const active = useMemo(() => accounts.filter((account) => account.isActive).sort((a, b) => a.sortOrder - b.sortOrder), [accounts]);
  const chosen = active.find((account) => account.id === value) ?? null;
  const emptyRow =
    empty === "total"
      ? { icon: TOTAL_ICON, color: colors.accent, title: t("home.total"), subtitle: money(totals.included, totals.currency, "accounts") }
      : { icon: NONE_ICON, color: colors.tonal, title: t("settings.noAccount"), subtitle: t("settings.noAccountHint") };

  const pick = (id: string | null) => {
    setOpen(false);
    onChange(id);
  };

  return (
    <>
      <FieldBox label={label} onPress={() => setOpen(true)}>
        <IconCircle icon={chosen?.icon ?? emptyRow.icon} color={chosen?.color ?? emptyRow.color} size={32} />
        <AppText style={{ flex: 1 }} numberOfLines={1} secondary={!chosen && empty === "none"}>
          {chosen?.name ?? emptyRow.title}
        </AppText>
      </FieldBox>

      <AppSheet visible={open} title={label} onClose={() => setOpen(false)}>
        <ScrollView style={{ maxHeight: 420 }} contentContainerStyle={{ gap: spacing.xs }}>
          <Choice {...emptyRow} selected={!chosen} highlight onPress={() => pick(null)} />
          {active.map((account) => (
            <Choice
              key={account.id}
              icon={account.icon}
              color={account.color}
              title={account.name}
              subtitle={money(balances.get(account.id) ?? 0, account.currency, "accounts")}
              selected={account.id === chosen?.id}
              onPress={() => pick(account.id)}
            />
          ))}
        </ScrollView>
      </AppSheet>
    </>
  );
}
