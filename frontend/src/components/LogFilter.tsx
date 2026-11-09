import { useMemo, useState } from "react";
import { ScrollView, View } from "react-native";
import type { EntryType } from "@/api/types";
import { categoriesOfType, categoryName } from "@/data/categories";
import { useCollection } from "@/data/hooks";
import { NO_TAG } from "@/data/stats";
import { useI18n } from "@/i18n/I18nProvider";
import { useTheme } from "@/theme/ThemeProvider";
import { spacing } from "@/theme/tokens";
import { Choice } from "./AccountFilterSelect";
import { AppSheet } from "./AppSheet";
import { AppText } from "./AppText";
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

const toggle = (list: string[], id: string) => (list.includes(id) ? list.filter((item) => item !== id) : [...list, id]);

// The filter button next to sorting in the transaction log, and its sheet from the bottom: categories of the shown
// type and tags, several of each.
export function LogFilter({ type, value, onChange }: { type: EntryType; value: LogNarrow; onChange: (value: LogNarrow) => void }) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const categories = useCollection("categories");
  const tags = useCollection("tags");
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<LogNarrow>(value);

  const shownCategories = useMemo(() => categoriesOfType(categories, type), [categories, type]);
  const sortedTags = useMemo(() => [...tags].sort((a, b) => a.name.localeCompare(b.name)), [tags]);
  const active = value.categories.length + value.tags.length > 0;

  return (
    <>
      <View>
        <IconButton
          icon="filter-variant"
          label={t("logs.filter")}
          onPress={() => {
            setDraft(value);
            setOpen(true);
          }}
          size={36}
          plain
        />
        {active && (
          <View pointerEvents="none" style={{ position: "absolute", top: 2, right: 2, width: 9, height: 9, borderRadius: 5, backgroundColor: colors.mark }} />
        )}
      </View>

      <AppSheet visible={open} title={t("logs.filter")} onClose={() => setOpen(false)}>
        <ScrollView style={{ maxHeight: 440 }} contentContainerStyle={{ gap: spacing.xs }}>
          <AppText variant="label" secondary>
            {t("logs.filterCategories")}
          </AppText>
          {shownCategories.map((category) => (
            <Choice
              key={category.id}
              icon={category.icon}
              color={category.color}
              title={categoryName(category, t)}
              selected={draft.categories.includes(category.id)}
              onPress={() => setDraft((current) => ({ ...current, categories: toggle(current.categories, category.id) }))}
            />
          ))}
          <AppText variant="label" secondary style={{ marginTop: spacing.sm }}>
            {t("logs.filterTags")}
          </AppText>
          {[...sortedTags.map((tag) => ({ id: tag.id, name: tag.name, icon: TAG_ICON, color: colors.iconIdle })), { id: NO_TAG, name: t("home.noTag"), icon: NO_TAG_ICON, color: NO_TAG_COLOR }].map(
            (tag) => (
              <Choice
                key={tag.id}
                icon={tag.icon}
                color={tag.color}
                title={tag.name}
                selected={draft.tags.includes(tag.id)}
                onPress={() => setDraft((current) => ({ ...current, tags: toggle(current.tags, tag.id) }))}
              />
            )
          )}
        </ScrollView>
        <View style={{ flexDirection: "row", gap: spacing.sm }}>
          <Button title={t("logs.filterReset")} variant="secondary" onPress={() => setDraft(NO_NARROW)} style={{ flex: 1 }} />
          <Button
            title={t("home.select")}
            onPress={() => {
              onChange(draft);
              setOpen(false);
            }}
            style={{ flex: 1 }}
          />
        </View>
      </AppSheet>
    </>
  );
}
