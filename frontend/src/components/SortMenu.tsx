import { type ComponentRef, useRef, useState } from "react";
import { Modal, Pressable, View, useWindowDimensions } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { IconName } from "@/constants/appearance";
import { useI18n } from "@/i18n/I18nProvider";
import { useTheme } from "@/theme/ThemeProvider";
import { radius, spacing } from "@/theme/tokens";
import { AppText } from "./AppText";

export type SortKey = "date" | "amount";
export type SortDirection = "desc" | "asc";
export type SortValue = { key: SortKey; direction: SortDirection };

// The button is drawn from the same parts as the menu (what + arrow), so its arrow always matches the menu's.
const KEY_ICONS: Record<SortKey, IconName> = { date: "calendar-month-outline", amount: "cash" };
const ARROWS: Record<SortDirection, IconName> = { desc: "arrow-down", asc: "arrow-up" };

const LABELS: Record<SortKey, string> = { date: "logs.sortDate", amount: "logs.sortAmount" };

// Screen 11: a small menu under the sort button. Two ways to sort; the arrow shows the direction, and choosing the
// current one again turns it around. A new one starts from the largest / newest.
export function SortMenu({ value, onChange }: { value: SortValue; onChange: (value: SortValue) => void }) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const { width } = useWindowDimensions();
  const anchor = useRef<ComponentRef<typeof View>>(null);
  const [position, setPosition] = useState<{ top: number; right: number } | null>(null);

  const open = () =>
    anchor.current?.measureInWindow((x, y, w, h) => setPosition({ top: y + h + 4, right: Math.max(spacing.sm, width - (x + w)) }));

  const pick = (key: SortKey) => {
    const direction: SortDirection = key === value.key ? (value.direction === "desc" ? "asc" : "desc") : "desc";
    onChange({ key, direction });
    setPosition(null);
  };

  return (
    <>
      <View ref={anchor} collapsable={false}>
        <Pressable
          onPress={open}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={`${t("logs.sort")}: ${t(LABELS[value.key])}`}
          style={({ pressed }) => ({
            flexDirection: "row",
            alignItems: "center",
            height: 40,
            paddingHorizontal: spacing.sm,
            borderRadius: radius.md,
            backgroundColor: pressed ? colors.selected : colors.tonal,
          })}
        >
          <MaterialCommunityIcons name={KEY_ICONS[value.key]} size={20} color={colors.text} />
          <MaterialCommunityIcons name={ARROWS[value.direction]} size={16} color={colors.text} />
        </Pressable>
      </View>
      <Modal visible={position !== null} transparent animationType="fade" onRequestClose={() => setPosition(null)} statusBarTranslucent>
        <Pressable style={{ flex: 1 }} onPress={() => setPosition(null)} accessibilityLabel={t("common.close")}>
          {position && (
            <View
              style={{
                position: "absolute",
                top: position.top,
                right: position.right,
                minWidth: 180,
                padding: spacing.xs,
                borderRadius: radius.md,
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.selected,
                shadowColor: "#000",
                shadowOpacity: 0.3,
                shadowRadius: 10,
                shadowOffset: { width: 0, height: 4 },
                elevation: 8,
              }}
            >
              {(["date", "amount"] as SortKey[]).map((key) => {
                const active = key === value.key;
                return (
                  <Pressable
                    key={key}
                    onPress={() => pick(key)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    style={({ pressed }) => ({
                      flexDirection: "row",
                      alignItems: "center",
                      gap: spacing.sm,
                      paddingVertical: spacing.sm,
                      paddingHorizontal: spacing.md,
                      borderRadius: radius.md,
                      backgroundColor: pressed ? colors.selected : active ? colors.tonal : "transparent",
                    })}
                  >
                    <AppText style={{ flex: 1 }} variant={active ? "heading" : "body"}>
                      {t(LABELS[key])}
                    </AppText>
                    <MaterialCommunityIcons
                      name={active ? ARROWS[value.direction] : ARROWS.desc}
                      size={20}
                      color={active ? colors.text : colors.textSecondary}
                    />
                  </Pressable>
                );
              })}
            </View>
          )}
        </Pressable>
      </Modal>
    </>
  );
}
