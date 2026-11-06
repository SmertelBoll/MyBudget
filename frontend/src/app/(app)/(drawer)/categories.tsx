import { useMemo, useState } from "react";
import { ScrollView, View } from "react-native";
import { router } from "expo-router";
import type { EntryType } from "@/api/types";
import { useAuth } from "@/auth/AuthProvider";
import { categoriesOfType, categoryName } from "@/data/categories";
import { useCollection } from "@/data/hooks";
import { moveItem } from "@/data/ordering";
import { reportWriteError } from "@/data/store";
import { useI18n } from "@/i18n/I18nProvider";
import { useTheme } from "@/theme/ThemeProvider";
import { spacing } from "@/theme/tokens";
import { useBottomSpace } from "@/utils/useBottomSpace";
import { BottomActionButton } from "@/components/BottomActionButton";
import { CategoryCell } from "@/components/CategoryCell";
import { IconButton } from "@/components/IconButton";
import { MoveBanner } from "@/components/MoveBanner";
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
  const [picked, setPicked] = useState<string | null>(null);

  const list = useMemo(() => categoriesOfType(categories, type), [categories, type]);
  const pickedCategory = list.find((category) => category.id === picked);

  const tap = (id: string) => {
    if (!picked) {
      router.push({ pathname: "/category/[id]", params: { id } });
      return;
    }
    if (id !== picked) moveItem("categories", list, picked, id).catch(reportWriteError);
    setPicked(null);
  };

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
            onChange={(next) => {
              setType(next);
              setPicked(null);
            }}
          />
        </View>
      </ScreenHeader>

      <ScrollView contentContainerStyle={{ padding: spacing.md, gap: spacing.md, paddingBottom: bottomSpace }}>
        {pickedCategory && <MoveBanner name={categoryName(pickedCategory, t)} onCancel={() => setPicked(null)} />}
        <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
          {list.map((category) => (
            <CategoryCell
              key={category.id}
              icon={category.icon}
              color={category.color}
              label={categoryName(category, t)}
              picked={category.id === picked}
              onPress={() => tap(category.id)}
              onLongPress={() => setPicked(category.id)}
            />
          ))}
        </View>
      </ScrollView>

      <BottomActionButton
        title={t("categories.new")}
        icon="plus"
        onPress={() => router.push({ pathname: "/category/[id]", params: { id: "new", type } })}
      />
    </View>
  );
}
