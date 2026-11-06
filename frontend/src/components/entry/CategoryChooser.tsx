import { useMemo, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { EntryType } from "@/api/types";
import { categoriesOfType, categoryName } from "@/data/categories";
import { useCollection } from "@/data/hooks";
import { useI18n } from "@/i18n/I18nProvider";
import { useTheme } from "@/theme/ThemeProvider";
import { spacing } from "@/theme/tokens";
import { AppText } from "../AppText";
import { Button } from "../Button";
import { CategoryCell } from "../CategoryCell";
import { FullScreenModal } from "../FullScreenModal";

const INLINE = 7;

// Spec 4.4: 4 per row, the first 7 categories and "More", which opens all of them with a "new category" button.
// A chosen category from further down takes the 7th place, so the choice is always visible.
export function CategoryChooser({
  type,
  value,
  onChange,
  error,
}: {
  type: EntryType;
  value: string | null;
  onChange: (categoryId: string) => void;
  error?: string;
}) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const categories = useCollection("categories");
  const [open, setOpen] = useState(false);

  const all = useMemo(() => categoriesOfType(categories, type), [categories, type]);
  const inline = all.slice(0, INLINE);
  const chosen = all.find((category) => category.id === value);
  if (chosen && !inline.includes(chosen)) inline[INLINE - 1] = chosen;

  return (
    <View style={{ gap: spacing.xs }}>
      <AppText variant="label" color={error ? colors.danger : undefined}>
        {t("entry.category")}
      </AppText>
      <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
        {inline.map((category) => (
          <CategoryCell
            key={category.id}
            icon={category.icon}
            color={category.color}
            label={categoryName(category, t)}
            selected={category.id === value}
            onPress={() => onChange(category.id)}
          />
        ))}
        <Pressable
          onPress={() => setOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={t("entry.allCategories")}
          style={{ width: "25%", alignItems: "center", gap: spacing.xs, paddingVertical: spacing.sm }}
        >
          <View style={{ width: 62, height: 62, borderRadius: 31, alignItems: "center", justifyContent: "center", backgroundColor: colors.tonal }}>
            <MaterialCommunityIcons name="dots-horizontal" size={28} color={colors.text} />
          </View>
          <AppText variant="caption">{t("entry.more")}</AppText>
        </Pressable>
      </View>
      {error ? (
        <AppText variant="caption" color={colors.danger}>
          {error}
        </AppText>
      ) : null}

      <FullScreenModal visible={open} title={t("entry.allCategories")} onClose={() => setOpen(false)}>
        <ScrollView contentContainerStyle={{ padding: spacing.md, gap: spacing.md, paddingBottom: insets.bottom + spacing.lg }}>
          <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
            {all.map((category) => (
              <CategoryCell
                key={category.id}
                icon={category.icon}
                color={category.color}
                label={categoryName(category, t)}
                selected={category.id === value}
                onPress={() => {
                  onChange(category.id);
                  setOpen(false);
                }}
              />
            ))}
          </View>
          <Button
            variant="secondary"
            icon="plus"
            title={t("categories.new")}
            onPress={() => {
              setOpen(false);
              router.push({ pathname: "/category/[id]", params: { id: "new", type } });
            }}
          />
        </ScrollView>
      </FullScreenModal>
    </View>
  );
}
