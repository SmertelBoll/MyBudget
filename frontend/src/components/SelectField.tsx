import { useMemo, useState } from "react";
import { FlatList, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useI18n } from "@/i18n/I18nProvider";
import { useTheme } from "@/theme/ThemeProvider";
import { radius, spacing } from "@/theme/tokens";
import { AppText } from "./AppText";
import { FullScreenModal } from "./FullScreenModal";
import { OptionRow } from "./OptionRow";
import { TextField } from "./TextField";

export type SelectOption = {
  value: string;
  label: string;
  // Second line, also searched: e.g. the English name of a language.
  subtitle?: string;
  // Short text on the right, also searched: e.g. the currency code next to its full name.
  trailing?: string;
};

type Props = {
  label: string;
  value: string | null;
  options: SelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  searchLabel?: string;
  // Shown first, above a divider (e.g. popular and recently used currencies); hidden while searching.
  pinned?: string[];
};

type Row = SelectOption | { divider: true };

// A field that opens a searchable list: languages, currencies... (spec 2.9, 4.2 "list with search").
export function SelectField({ label, value, options, onChange, placeholder, searchLabel, pinned }: Props) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selected = options.find((option) => option.value === value);

  const rows = useMemo<Row[]>(() => {
    const needle = query.trim().toLowerCase();
    if (needle) {
      return options.filter((option) =>
        [option.label, option.subtitle, option.trailing, option.value].some((text) => text?.toLowerCase().includes(needle))
      );
    }
    const top = (pinned ?? [])
      .map((code) => options.find((option) => option.value === code))
      .filter((option): option is SelectOption => Boolean(option));
    if (!top.length) return options;
    const rest = options.filter((option) => !top.includes(option));
    return [...top, { divider: true }, ...rest];
  }, [options, query, pinned]);

  const close = () => {
    setOpen(false);
    setQuery("");
  };

  return (
    <View style={{ gap: spacing.xs }}>
      <AppText variant="label">{label}</AppText>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${selected?.label ?? placeholder ?? ""}`}
        style={({ pressed }) => ({
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.sm,
          minHeight: 48,
          paddingHorizontal: spacing.md,
          borderRadius: radius.md,
          borderWidth: 1.5,
          borderColor: colors.selected,
          backgroundColor: pressed ? colors.selected : colors.surface,
        })}
      >
        <AppText style={{ flex: 1 }} secondary={!selected} numberOfLines={1}>
          {selected?.label ?? placeholder ?? ""}
        </AppText>
        {selected?.trailing ? <AppText variant="label" secondary>{selected.trailing}</AppText> : null}
        <MaterialCommunityIcons name="chevron-down" size={22} color={colors.textSecondary} />
      </Pressable>

      <FullScreenModal visible={open} title={label} onClose={close}>
        <View style={{ padding: spacing.md }}>
          <TextField
            label={searchLabel ?? t("common.search")}
            value={query}
            onChangeText={setQuery}
            autoCapitalize="none"
            autoCorrect={false}
            autoFocus
          />
        </View>

        <FlatList
          data={rows}
          keyExtractor={(row) => ("divider" in row ? "--divider--" : row.value)}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: insets.bottom + spacing.lg }}
          ListEmptyComponent={
            <AppText secondary style={{ textAlign: "center", padding: spacing.lg }}>
              {t("common.nothingFound")}
            </AppText>
          }
          renderItem={({ item }) =>
            "divider" in item ? (
              <View style={{ height: 1, backgroundColor: colors.selected, marginHorizontal: spacing.md, marginVertical: spacing.xs }} />
            ) : (
              <OptionRow
                title={item.label}
                subtitle={item.subtitle}
                trailing={item.trailing}
                selected={item.value === value}
                onPress={() => {
                  onChange(item.value);
                  close();
                }}
              />
            )
          }
        />
      </FullScreenModal>
    </View>
  );
}
