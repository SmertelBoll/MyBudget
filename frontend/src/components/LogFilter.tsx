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

type Option = { id: string; icon: string; color: string; title: string };

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
  const tags = useCollection("tags");
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
            ...[...tags]
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((tag) => ({ id: tag.id, icon: TAG_ICON, color: colors.iconIdle, title: tag.name })),
            { id: NO_TAG, icon: NO_TAG_ICON, color: NO_TAG_COLOR, title: t("home.noTag") },
          ],
    [kind, categories, tags, type, t, colors.iconIdle]
  );
  const title = t(kind === "categories" ? "logs.filterCategories" : "logs.filterTags");

  return (
    <>
      <View>
        <IconButton
          icon={kind === "categories" ? "shape-outline" : "pound"}
          label={title}
          onPress={() => {
            setDraft(value[kind]);
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
          {options.map((option) => (
            <Choice
              key={option.id}
              icon={option.icon}
              color={option.color}
              title={option.title}
              selected={draft.includes(option.id)}
              onPress={() => setDraft((current) => toggle(current, option.id))}
            />
          ))}
        </ScrollView>
        <View style={{ flexDirection: "row", gap: spacing.sm }}>
          <Button title={t("logs.filterReset")} variant="secondary" onPress={() => setDraft([])} style={{ flex: 1 }} />
          <Button
            title={t("home.select")}
            onPress={() => {
              onChange({ ...value, [kind]: draft });
              setOpen(false);
            }}
            style={{ flex: 1 }}
          />
        </View>
      </AppSheet>
    </>
  );
}
