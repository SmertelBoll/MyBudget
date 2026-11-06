import { Pressable, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useI18n } from "@/i18n/I18nProvider";
import { useTheme } from "@/theme/ThemeProvider";
import { radius, spacing } from "@/theme/tokens";
import { AppText } from "./AppText";
import { IconCircle } from "./IconCircle";

export type StatsChild = { id: string; icon: string; title: string; amount: string };

const percent = (share: number) => {
  const value = share * 100;
  if (value > 0 && value < 1) return "<1%";
  return `${Math.round(value)}%`;
};

// Home (spec 2.3): a category (or tag) with its share and sum for the period; tapping opens the sums by tag (or by
// category). With a monthly limit and the month period, a bar shows how much of it is used (screen 7).
export function StatsRow({
  icon,
  color,
  title,
  share,
  amount,
  breakdown,
  expanded,
  onToggle,
  limit,
}: {
  icon: string;
  color: string;
  title: string;
  share: number;
  amount: string;
  // Nothing to open when every entry falls into one group with no tag.
  breakdown: StatsChild[];
  expanded: boolean;
  onToggle: () => void;
  limit?: { used: number; text: string };
}) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const openable = breakdown.length > 0;
  const over = limit ? limit.used > 1 : false;

  return (
    <View style={{ borderRadius: radius.md, overflow: "hidden", backgroundColor: colors.surface }}>
      <Pressable
        onPress={openable ? onToggle : undefined}
        disabled={!openable}
        accessibilityRole={openable ? "button" : undefined}
        accessibilityState={openable ? { expanded } : undefined}
        accessibilityHint={openable ? t(expanded ? "home.hideDetails" : "home.showDetails") : undefined}
        style={({ pressed }) => ({
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.sm,
          paddingVertical: spacing.md,
          paddingLeft: spacing.md,
          paddingRight: spacing.sm,
          backgroundColor: pressed ? colors.selected : "transparent",
        })}
      >
        <IconCircle icon={icon} color={color} size={40} />
        <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
          <AppText variant="heading" numberOfLines={1}>
            {title}
          </AppText>
          {limit && (
            <View style={{ gap: 2 }}>
              <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.selected, overflow: "hidden" }}>
                <View style={{ width: `${Math.min(limit.used, 1) * 100}%`, height: 6, backgroundColor: over ? colors.danger : colors.accent }} />
              </View>
              <AppText variant="caption" color={over ? colors.danger : colors.textSecondary}>
                {limit.text}
              </AppText>
            </View>
          )}
        </View>
        <AppText variant="label" secondary style={{ minWidth: 40, textAlign: "right" }}>
          {percent(share)}
        </AppText>
        <AppText variant="heading" style={{ minWidth: 72, textAlign: "right" }}>
          {amount}
        </AppText>
        <View style={{ width: 22, alignItems: "center" }}>
          {openable && <MaterialCommunityIcons name={expanded ? "chevron-up" : "chevron-down"} size={22} color={colors.textSecondary} />}
        </View>
      </Pressable>
      {expanded &&
        breakdown.map((child) => (
          <View
            key={child.id}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.md,
              paddingVertical: spacing.sm,
              paddingLeft: spacing.md + 10,
              paddingRight: spacing.md + 22 + spacing.md,
              backgroundColor: colors.tonal,
            }}
          >
            <MaterialCommunityIcons name={child.icon as "pound"} size={18} color={colors.textSecondary} />
            <AppText numberOfLines={1} style={{ flex: 1 }}>
              {child.title}
            </AppText>
            <AppText>{child.amount}</AppText>
          </View>
        ))}
    </View>
  );
}
