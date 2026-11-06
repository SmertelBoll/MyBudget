import { Pressable, View } from "react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { radius, spacing } from "@/theme/tokens";
import { AppText } from "./AppText";

type Option<T extends string> = { value: T; label: string };

// Expenses / Income, Categories / Tags, theme picker: one look for every switch (spec 2.2, 4.1).
export function SegmentedSwitch<T extends string>({
  options,
  value,
  onChange,
}: {
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
}) {
  const { colors } = useTheme();
  return (
    <View
      accessibilityRole="tablist"
      style={{ flexDirection: "row", backgroundColor: colors.background, borderRadius: radius.md, padding: spacing.xs }}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            style={{
              flex: 1,
              alignItems: "center",
              paddingVertical: spacing.sm,
              borderRadius: radius.md,
              backgroundColor: active ? colors.accent : "transparent",
            }}
          >
            {/* Inactive options use the main text color: secondary grey was too faint on the light background. */}
            <AppText variant="label" color={active ? colors.onAccent : colors.text}>
              {option.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}
