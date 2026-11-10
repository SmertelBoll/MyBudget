import { useMemo, useState } from "react";
import { View } from "react-native";
import { ScrollView } from "react-native-gesture-handler";
import { router } from "expo-router";
import type { EntryType } from "@/api/types";
import { useAuth } from "@/auth/AuthProvider";
import { categoriesOfType, categoryName, isHiddenCategory } from "@/data/categories";
import { useCollection } from "@/data/hooks";
import { applyOrder } from "@/data/ordering";
import { reportWriteError } from "@/data/store";
import { useI18n } from "@/i18n/I18nProvider";
import { useTheme } from "@/theme/ThemeProvider";
import { spacing } from "@/theme/tokens";
import { useBottomSpace } from "@/utils/useBottomSpace";
import { BottomActionButton } from "@/components/BottomActionButton";
import { CategoryCell } from "@/components/CategoryCell";
import { HiddenSectionHeader } from "@/components/HiddenSectionHeader";
import { IconButton } from "@/components/IconButton";
import { Reorderable } from "@/components/Reorderable";
import { ScreenHeader } from "@/components/ScreenHeader";
import { SegmentedSwitch } from "@/components/SegmentedSwitch";

// Screen 7.1. Expenses and income have separate categories and separate order.
export default function CategoriesScreen() {
  const { colors } = useTheme();
  const bottomSpace = useBottomSpace();
  const { t } = useI18n();
  const { user } = useAuth();
  const categories = useCollection("categories");
  // Starts on the side chosen in Settings -> Advanced (focus); kept while the screen lives (spec 2.7).
  const [type, setType] = useState<EntryType>(user?.settings.focus ?? "expense");
  const [dragging, setDragging] = useState(false);

  const [showHidden, setShowHidden] = useState(false);

  const ofType = useMemo(() => categoriesOfType(categories, type), [categories, type]);
  const list = useMemo(() => ofType.filter((category) => !isHiddenCategory(category)), [ofType]);
  // Hidden ones sit under a fold below the list and are not reordered.
  const hidden = useMemo(() => ofType.filter(isHiddenCategory), [ofType]);


  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader
        title={t("nav.categories")}
        right={<IconButton icon="tag-multiple-outline" label={t("tags.title")} onPress={() => router.push("/tags")} />}
      >
        <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.xs }}>
          <SegmentedSwitch
            options={[
              { value: "expense", label: t("entries.expenses") },
              { value: "income", label: t("entries.income") },
            ]}
            value={type}
            onChange={setType}
          />
        </View>
      </ScreenHeader>

      <ScrollView scrollEnabled={!dragging} contentContainerStyle={{ padding: spacing.md, gap: spacing.md, paddingBottom: bottomSpace }}>
        {/* Long press and drag to put a category elsewhere (spec 7.1). */}
        <Reorderable
          items={list}
          keyOf={(category) => category.id}
          style={{ flexDirection: "row", flexWrap: "wrap" }}
          itemStyle={{ width: "25%" }}
          onDragChange={setDragging}
          onReorder={(keys) => applyOrder("categories", list, keys).catch(reportWriteError)}
          renderItem={(category) => (
            <CategoryCell
              width="100%"
              icon={category.icon}
              color={category.color}
              label={categoryName(category, t)}
              onPress={() => router.push({ pathname: "/category/[id]", params: { id: category.id } })}
            />
          )}
        />
        {hidden.length > 0 && (
          <View>
            <HiddenSectionHeader count={hidden.length} open={showHidden} onToggle={() => setShowHidden(!showHidden)} />
            {showHidden && (
              <View style={{ flexDirection: "row", flexWrap: "wrap", opacity: 0.6 }}>
                {hidden.map((category) => (
                  <CategoryCell
                    key={category.id}
                    icon={category.icon}
                    color={category.color}
                    label={categoryName(category, t)}
                    onPress={() => router.push({ pathname: "/category/[id]", params: { id: category.id } })}
                  />
                ))}
              </View>
            )}
          </View>
        )}
      </ScrollView>

      <BottomActionButton
        title={t("categories.new")}
        icon="plus"
        onPress={() => router.push({ pathname: "/category/[id]", params: { id: "new", type } })}
      />
    </View>
  );
}
