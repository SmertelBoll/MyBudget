import { Pressable, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTheme } from "@/theme/ThemeProvider";
import { radius, spacing } from "@/theme/tokens";
import { AppText } from "./AppText";
import { IconCircle } from "./IconCircle";

// Screen 11 (screenshot 38): category and account on the left, the sum in the main currency and, when the entry
// was in another currency, its own sum below; then the tags and the comment.
export function LogRow({
  icon,
  color,
  title,
  account,
  amount,
  original,
  tags,
  comment,
  hasPhotos,
  onPress,
}: {
  icon: string;
  color: string;
  title: string;
  account: string;
  amount: string;
  original?: string;
  tags: { name: string; color: string }[];
  comment?: string;
  hasPhotos?: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => ({
        gap: spacing.sm,
        padding: spacing.md,
        borderRadius: radius.md,
        backgroundColor: pressed ? colors.selected : colors.surface,
      })}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
        <IconCircle icon={icon} color={color} size={44} />
        <View style={{ flex: 1 }}>
          <AppText variant="heading" numberOfLines={1}>
            {title}
          </AppText>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <AppText variant="caption" secondary numberOfLines={1} style={{ flexShrink: 1 }}>
              {account}
            </AppText>
            {hasPhotos && <MaterialCommunityIcons name="image-outline" size={14} color={colors.textSecondary} />}
          </View>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <AppText variant="heading">{amount}</AppText>
          {original ? (
            <AppText variant="caption" secondary>
              {original}
            </AppText>
          ) : null}
        </View>
      </View>
      {tags.length > 0 && (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.xs }}>
          {tags.map((tag) => (
            <View
              key={tag.name}
              style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.md, backgroundColor: colors.tonal }}
            >
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: tag.color }} />
              <AppText variant="caption">{tag.name}</AppText>
            </View>
          ))}
        </View>
      )}
      {comment ? (
        <AppText variant="caption" secondary numberOfLines={2}>
          {comment}
        </AppText>
      ) : null}
    </Pressable>
  );
}
