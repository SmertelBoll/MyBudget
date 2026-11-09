import { useMemo, useState } from "react";
import { ScrollView, View } from "react-native";
import type { EntryType } from "@/api/types";
import { categoriesOfType, categoryName } from "@/data/categories";
import { useCollection } from "@/data/hooks";
import { NO_TAG } from "@/data/stats";
import { useTagTree } from "@/data/tags";
import { useI18n } from "@/i18n/I18nProvider";
import { useTheme } from "@/theme/ThemeProvider";
import { spacing } from "@/theme/tokens";
import { Choice } from "./AccountFilterSelect";
import { AppSheet } from "./AppSheet";
import { Button } from "./Button";
import { NO_TAG_COLOR, NO_TAG_ICON, TAG_ICON } from "./GroupRow";
import { IconButton } from "./IconButton";

// Empty lists = no narrowing.
export type LogNarrow = { categories: string[]; tags: string[] };
export const NO_NARROW: LogNarrow = { categories: [], tags: [] };

// Whether an entry passes the chosen categories and tags. With several of each, any one of them is enough; "No tag"
// is an option of its own.
export const passesNarrow = (narrow: LogNarrow, categoryId: string, tagIds: string[], knownTag: (id: string) => boolean) => {
  if (narrow.categories.length && !narrow.categories.includes(categoryId)) return false;
  if (!narrow.tags.length) return true;
  const known = tagIds.filter(knownTag);
  if (!known.length) return narrow.tags.includes(NO_TAG);
  return known.some((id) => narrow.tags.includes(id));
};

// A top-level tag lists its subtags after it (depth 1, indented); ticking it ticks them too.
type Option = { id: string; icon: string; color: string; title: string; depth?: number; children?: string[] };

// One filter button next to sorting in the transaction log ("categories" or "tags") and its sheet from the bottom;
// several can be chosen. A dot on the button means it narrows the list.
export function LogFilter({
  kind,
  type,
  value,
  onChange,
}: {
  kind: "categories" | "tags";
  type: EntryType;
  value: LogNarrow;
  onChange: (value: LogNarrow) => void;
}) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const categories = useCollection("categories");
  const tagTree = useTagTree();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<string[]>(value[kind]);

  const options = useMemo<Option[]>(
    () =>
      kind === "categories"
        ? categoriesOfType(categories, type).map((category) => ({
            id: category.id,
            icon: category.icon,
            color: category.color,
            title: categoryName(category, t),
          }))
        : [
            ...tagTree.ordered.map(({ tag, depth }) => ({
              id: tag.id,
              icon: TAG_ICON,
              color: tagTree.colorOf(tag.id),
              title: tag.name,
              depth,
              children: depth ? undefined : tagTree.children.get(tag.id)?.map((child) => child.id),
            })),
            { id: NO_TAG, icon: NO_TAG_ICON, color: NO_TAG_COLOR, title: t("home.noTag") },
          ],
    [kind, categories, tagTree, type, t]
  );
  const title = t(kind === "categories" ? "logs.filterCategories" : "logs.filterTags");
  // No narrowing is shown as everything ticked; everything ticked is saved as no narrowing (so a category or tag
  // added later is in too).
  const allIds = options.map((option) => option.id);
  const allChosen = allIds.every((id) => draft.includes(id));

  return (
    <>
      <View>
        <IconButton
          icon={kind === "categories" ? "shape-outline" : "pound"}
          label={title}
          onPress={() => {
            setDraft(value[kind].length ? value[kind] : allIds);
            setOpen(true);
          }}
          size={36}
          plain
        />
        {value[kind].length > 0 && (
          <View pointerEvents="none" style={{ position: "absolute", top: 2, right: 2, width: 9, height: 9, borderRadius: 5, backgroundColor: colors.mark }} />
        )}
      </View>

      <AppSheet visible={open} title={title} onClose={() => setOpen(false)}>
        <ScrollView style={{ maxHeight: 440 }} contentContainerStyle={{ gap: spacing.xs }}>
          <Choice icon="check-all" color={colors.accent} title={t("logs.filterAll")} selected={allChosen} highlight onPress={() => setDraft(allChosen ? [] : allIds)} />
          {options.map((option) => (
            <View key={option.id} style={{ paddingLeft: option.depth ? spacing.xl : 0 }}>
              <Choice
                icon={option.icon}
                color={option.color}
                title={option.title}
                selected={draft.includes(option.id)}
                onPress={() =>
                  setDraft((current) => {
                    const on = !current.includes(option.id);
                    const ids = [option.id, ...(option.children ?? [])];
                    return on ? [...current.filter((id) => !ids.includes(id)), ...ids] : current.filter((id) => !ids.includes(id));
                  })
                }
              />
            </View>
          ))}
        </ScrollView>
        <View style={{ flexDirection: "row", gap: spacing.sm }}>
          <Button title={t("common.cancel")} variant="secondary" onPress={() => setOpen(false)} style={{ flex: 1 }} />
          <Button
            title={t("home.select")}
            disabled={!draft.length}
            onPress={() => {
              onChange({ ...value, [kind]: allChosen ? [] : draft });
              setOpen(false);
            }}
            style={{ flex: 1 }}
          />
        </View>
      </AppSheet>
    </>
  );
}
