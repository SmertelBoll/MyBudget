import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { IconName, IconSection } from "@/constants/appearance";
import { useI18n } from "@/i18n/I18nProvider";
import { useTheme } from "@/theme/ThemeProvider";
import { radius, spacing } from "@/theme/tokens";
import { AppText } from "./AppText";
import { FullScreenModal } from "./FullScreenModal";
import { IconCircle } from "./IconCircle";

const PER_ROW = 4;
// Two rows: 7 icons and the "…" cell (spec 5.2).
const INLINE = PER_ROW * 2 - 1;

function IconCell({
  icon,
  color,
  selected,
  onPress,
}: {
  icon: string;
  color: string;
  selected: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={icon}
      style={{
        width: `${100 / PER_ROW}%`,
        alignItems: "center",
        paddingVertical: spacing.sm,
      }}
    >
      <View
        style={{
          padding: 3,
          borderRadius: radius.md,
          borderWidth: 2,
          borderColor: selected ? colors.accent : "transparent",
        }}
      >
        <IconCircle icon={icon} color={selected ? color : colors.selected} size={56} />
      </View>
    </Pressable>
  );
}

// Spec 2.9 IconPicker: two rows inline; "…" opens every icon grouped into sections. The selected icon is always
// among the inline ones, so the user sees their choice without opening the full list.
export function IconPicker({
  label,
  sections,
  value,
  color,
  onChange,
}: {
  label: string;
  sections: IconSection[];
  value: string;
  color: string;
  onChange: (icon: IconName) => void;
}) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);

  const all = sections.flatMap((section) => section.icons);
  const inline = all.slice(0, INLINE);
  if (!inline.includes(value as IconName) && all.includes(value as IconName)) {
    inline[INLINE - 1] = value as IconName;
  }

  return (
    <View style={{ gap: spacing.xs }}>
      <AppText variant="label">{label}</AppText>
      <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
        {inline.map((icon) => (
          <IconCell key={icon} icon={icon} color={color} selected={icon === value} onPress={() => onChange(icon)} />
        ))}
        <Pressable
          onPress={() => setOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={t("icons.more")}
          style={{ width: `${100 / PER_ROW}%`, alignItems: "center", justifyContent: "center", paddingVertical: spacing.sm }}
        >
          <View
            style={{
              width: 56,
              height: 56,
              borderRadius: 28,
              alignItems: "center",
              justifyContent: "center",
              borderWidth: 1.5,
              borderColor: colors.selected,
            }}
          >
            <MaterialCommunityIcons name="dots-horizontal" size={28} color={colors.text} />
          </View>
        </Pressable>
      </View>

      <FullScreenModal visible={open} title={label} onClose={() => setOpen(false)}>
        <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: insets.bottom + spacing.lg, gap: spacing.md }}>
          {sections.map((section) => (
            <View key={section.title} style={{ gap: spacing.xs }}>
              <AppText variant="heading">{t(section.title)}</AppText>
              <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
                {section.icons.map((icon) => (
                  <IconCell
                    key={icon}
                    icon={icon}
                    color={color}
                    selected={icon === value}
                    onPress={() => {
                      onChange(icon);
                      setOpen(false);
                    }}
                  />
                ))}
              </View>
            </View>
          ))}
        </ScrollView>
      </FullScreenModal>
    </View>
  );
}
