import { Pressable, Switch } from "react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { spacing } from "@/theme/tokens";
import { AppText } from "./AppText";

// A label with a switch; the whole row toggles.
export function ToggleRow({ label, value, onChange }: { label: string; value: boolean; onChange: (value: boolean) => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={() => onChange(!value)}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, minHeight: 48 }}
    >
      <AppText style={{ flex: 1 }}>{label}</AppText>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: colors.selected, true: colors.accentMuted }}
        thumbColor={value ? colors.accent : colors.surface}
        ios_backgroundColor={colors.selected}
      />
    </Pressable>
  );
}
