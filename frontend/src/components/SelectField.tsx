import { useMemo, useState } from "react";
import { FlatList, Modal, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useI18n } from "@/i18n/I18nProvider";
import { useTheme } from "@/theme/ThemeProvider";
import { radius, spacing } from "@/theme/tokens";
import { AppText } from "./AppText";
import { OptionRow } from "./OptionRow";
import { TextField } from "./TextField";

export type SelectOption = {
  value: string;
  label: string;
  // Second line, also searched: e.g. the English name of a language, the full name of a currency.
  subtitle?: string;
};

type Props = {
  label: string;
  value: string | null;
  options: SelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  searchLabel?: string;
};

// A field that opens a searchable list: languages, currencies, accounts... (spec 2.9, 4.2 "list with search").
export function SelectField({ label, value, options, onChange, placeholder, searchLabel }: Props) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selected = options.find((option) => option.value === value);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return options;
    return options.filter((option) =>
      [option.label, option.subtitle, option.value].some((text) => text?.toLowerCase().includes(needle))
    );
  }, [options, query]);

  const close = () => {
    setOpen(false);
    setQuery("");
  };

  return (
    <View style={{ gap: spacing.xs }}>
      <AppText variant="label" secondary>
        {label}
      </AppText>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${selected?.label ?? placeholder ?? ""}`}
        style={({ pressed }) => ({
          flexDirection: "row",
          alignItems: "center",
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
        <MaterialCommunityIcons name="chevron-down" size={22} color={colors.textSecondary} />
      </Pressable>

      <Modal visible={open} animationType="slide" onRequestClose={close} statusBarTranslucent>
        <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.sm,
              paddingHorizontal: spacing.sm,
              paddingVertical: spacing.sm,
              backgroundColor: colors.surface,
            }}
          >
            <Pressable onPress={close} hitSlop={8} accessibilityRole="button" accessibilityLabel={t("common.close")} style={{ padding: spacing.sm }}>
              <MaterialCommunityIcons name="close" size={26} color={colors.text} />
            </Pressable>
            <AppText variant="title" numberOfLines={1} style={{ flex: 1 }}>
              {label}
            </AppText>
          </View>

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
            data={filtered}
            keyExtractor={(option) => option.value}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: insets.bottom + spacing.lg }}
            ListEmptyComponent={
              <AppText secondary style={{ textAlign: "center", padding: spacing.lg }}>
                {t("common.nothingFound")}
              </AppText>
            }
            renderItem={({ item }) => (
              <OptionRow
                title={item.label}
                subtitle={item.subtitle}
                selected={item.value === value}
                onPress={() => {
                  onChange(item.value);
                  close();
                }}
              />
            )}
          />
        </View>
      </Modal>
    </View>
  );
}
