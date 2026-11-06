import { useMemo, useState } from "react";
import { Pressable, ScrollView, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { COLOR_PAGES, HEX_COLOR, QUICK_COLORS, QUICK_COLOR_COUNT } from "@/constants/appearance";
import { useCollection } from "@/data/hooks";
import { useI18n } from "@/i18n/I18nProvider";
import { useTheme } from "@/theme/ThemeProvider";
import { spacing } from "@/theme/tokens";
import { AppText } from "./AppText";
import { Button } from "./Button";
import { FullScreenModal } from "./FullScreenModal";
import { contrastOn } from "./IconCircle";
import { TextField } from "./TextField";

const SWATCH = 40;
const CELL = `${100 / 7}%` as const;

function Swatch({ color, selected, onPress, size = SWATCH }: { color: string; selected: boolean; onPress: () => void; size?: number }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={color}
      hitSlop={4}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: selected ? 2 : 0,
        borderColor: colors.text,
      }}
    >
      {selected && <MaterialCommunityIcons name="check" size={size * 0.55} color={contrastOn(color)} />}
    </Pressable>
  );
}

// Colors the user actually picked, newest first (from their accounts and categories, so they follow the account to
// other devices), then the defaults. The current value is always in the rows.
const useRecentColors = (value: string) => {
  const accounts = useCollection("accounts");
  const categories = useCollection("categories");
  return useMemo(() => {
    // A record saved offline has no server time yet: it's the newest.
    const used = [...accounts, ...categories]
      .map((record) => ({ color: record.color.toLowerCase(), at: record.updatedAt ?? "9999" }))
      .sort((a, b) => b.at.localeCompare(a.at))
      .map((entry) => entry.color);
    return [...new Set([value.toLowerCase(), ...used, ...QUICK_COLORS])].slice(0, QUICK_COLOR_COUNT - 1);
  }, [accounts, categories, value]);
};

// Spec 2.9 ColorPicker: a row of colors and "more", which opens pages of shades (swipe sideways) with a #RRGGBB
// field on top and a confirm button at the bottom.
export function ColorPicker({ label, value, onChange }: { label: string; value: string; onChange: (color: string) => void }) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const [hex, setHex] = useState(value);
  const [page, setPage] = useState(0);

  const row = useRecentColors(value);
  const hexValid = HEX_COLOR.test(hex);

  const openPicker = () => {
    setDraft(value);
    setHex(value);
    setOpen(true);
  };

  const pick = (color: string) => {
    setDraft(color);
    setHex(color);
  };

  return (
    <View style={{ gap: spacing.sm }}>
      <AppText variant="label">{label}</AppText>
      {/* Two rows of seven: the recent colors, then "+" in the last cell. */}
      <View style={{ flexDirection: "row", flexWrap: "wrap", rowGap: spacing.sm }}>
        {row.map((color) => (
          <View key={color} style={{ width: CELL, alignItems: "center" }}>
            <Swatch color={color} selected={color.toLowerCase() === value.toLowerCase()} onPress={() => onChange(color)} />
          </View>
        ))}
        <View style={{ width: CELL, alignItems: "center" }}>
          <Pressable
            onPress={openPicker}
            accessibilityRole="button"
            accessibilityLabel={t("colors.more")}
            style={({ pressed }) => ({
              width: SWATCH,
              height: SWATCH,
              borderRadius: SWATCH / 2,
              backgroundColor: pressed ? colors.selected : colors.tonal,
              alignItems: "center",
              justifyContent: "center",
            })}
          >
            <MaterialCommunityIcons name="plus" size={24} color={colors.text} />
          </Pressable>
        </View>
      </View>

      <FullScreenModal visible={open} title={t("colors.title")} onClose={() => setOpen(false)}>
        <View style={{ padding: spacing.md }}>
          <TextField
            label={t("colors.hex")}
            value={hex}
            onChangeText={(text) => {
              const next = text.startsWith("#") ? text : `#${text}`;
              setHex(next.slice(0, 7));
              if (HEX_COLOR.test(next)) setDraft(next.toLowerCase());
            }}
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={7}
            error={hex.length === 7 && !hexValid ? t("colors.hexInvalid") : undefined}
          />
        </View>

        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(event) => setPage(Math.round(event.nativeEvent.contentOffset.x / width))}
          onScroll={(event) => setPage(Math.round(event.nativeEvent.contentOffset.x / width))}
          scrollEventThrottle={64}
        >
          {COLOR_PAGES.map((rows, index) => (
            <View key={index} style={{ width, paddingHorizontal: spacing.md, gap: spacing.md }}>
              {rows.map((shades, rowIndex) => (
                <View key={rowIndex} style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  {shades.map((color) => (
                    <Swatch key={color} color={color} size={44} selected={color === draft} onPress={() => pick(color)} />
                  ))}
                </View>
              ))}
            </View>
          ))}
        </ScrollView>

        <View style={{ flexDirection: "row", justifyContent: "center", gap: spacing.sm, padding: spacing.md }}>
          {COLOR_PAGES.map((_, index) => (
            <View
              key={index}
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: index === page ? colors.accent : colors.selected,
              }}
            />
          ))}
        </View>

        <View style={{ flex: 1 }} />
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md, paddingBottom: insets.bottom + spacing.md }}>
          <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: draft }} />
          <Button
            title={t("colors.select")}
            style={{ flex: 1 }}
            onPress={() => {
              onChange(draft);
              setOpen(false);
            }}
          />
        </View>
      </FullScreenModal>
    </View>
  );
}
