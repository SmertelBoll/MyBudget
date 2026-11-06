import { useMemo } from "react";
import { router } from "expo-router";
import type { EntryType } from "@/api/types";
import { categoryName } from "@/data/categories";
import { useCollection } from "@/data/hooks";
import { NO_TAG, type AccountFilter, type Group } from "@/data/stats";
import { useI18n } from "@/i18n/I18nProvider";
import { useTheme } from "@/theme/ThemeProvider";
import type { PeriodRange } from "@/utils/periods";
import { useMoney } from "@/utils/useMoney";
import { StatsRow, type StatsChild } from "./StatsRow";

// Tags are grey for now (no colors of their own); "no tag" has its own color. A row's icon and its part of a chart
// always use the same color.
export const NO_TAG_COLOR = "#6D7FA3";
export const TAG_ICON = "pound";
export const NO_TAG_ICON = "tag-off-outline";

export type GroupBy = "category" | "tag";

// Opens the log (spec 11) for these accounts, type and period, optionally narrowed to one category and / or tag.
export const logsParams = (
  type: EntryType,
  filter: AccountFilter,
  range: PeriodRange,
  only: { category?: string; tag?: string } = {}
) => ({
  type,
  accounts: filter?.join(",") ?? "",
  kind: range.kind,
  start: range.start,
  end: range.end,
  ...only,
});

export const openLog = (type: EntryType, filter: AccountFilter, range: PeriodRange, only?: { category?: string; tag?: string }) =>
  router.push({ pathname: "/logs", params: logsParams(type, filter, range, only) });

// Icon, color and name of a category or tag group (Home, Charts).
export const useGroupLook = (by: GroupBy) => {
  const { colors } = useTheme();
  const { t } = useI18n();
  const categories = useCollection("categories");
  const tags = useCollection("tags");
  const categoryById = useMemo(() => new Map(categories.map((category) => [category.id, category])), [categories]);
  const tagById = useMemo(() => new Map(tags.map((tag) => [tag.id, tag])), [tags]);

  const tagLook = (id: string) => {
    const tag = tagById.get(id);
    return { icon: tag ? TAG_ICON : NO_TAG_ICON, color: tag ? colors.iconIdle : NO_TAG_COLOR, title: tag?.name ?? t("home.noTag") };
  };
  const categoryLook = (id: string) => {
    const category = categoryById.get(id);
    return {
      icon: category?.icon ?? "help",
      color: category?.color ?? colors.iconIdle,
      title: category ? categoryName(category, t) : "?",
      plannedMonthly: category?.plannedMonthly ?? null,
    };
  };
  const look = (id: string) => (by === "tag" ? tagLook(id) : categoryLook(id));
  // Inside a row: tags of a category, or categories of a tag.
  const childLook = (id: string) => (by === "tag" ? categoryLook(id) : tagLook(id));
  return { look, childLook, knownTags: tagById };
};

// One row of Home's list (spec 2.3), also under the chart on Charts (spec 6): share, sum, the arrow that opens the
// sums inside, a monthly limit bar for the month period, and a tap that opens the matching log.
export function GroupRow({
  group,
  by,
  type,
  filter,
  range,
  expanded,
  onToggle,
}: {
  group: Group;
  by: GroupBy;
  type: EntryType;
  filter: AccountFilter;
  range: PeriodRange;
  expanded: boolean;
  onToggle: () => void;
}) {
  const { t } = useI18n();
  const { money, baseCurrency } = useMoney();
  const { look, childLook } = useGroupLook(by);
  const { icon, color, title } = look(group.id);

  // A category whose entries have no tags has nothing to open.
  const onlyNoTag = by === "category" && group.children.every((child) => child.id === NO_TAG);
  const breakdown: StatsChild[] = onlyNoTag
    ? []
    : group.children.map((child) => {
        const inner = childLook(child.id);
        return { id: child.id, icon: inner.icon, title: inner.title, amount: money(child.amount, baseCurrency, true) };
      });

  const planned = by === "category" && range.kind === "month" ? (look(group.id) as { plannedMonthly?: number | null }).plannedMonthly : null;
  const limit = planned
    ? {
        used: group.amount / planned,
        text: t("home.planned", { spent: money(group.amount, baseCurrency), planned: money(planned, baseCurrency) }),
      }
    : undefined;

  return (
    <StatsRow
      icon={icon}
      color={color}
      title={title}
      share={group.share}
      amount={money(group.amount, baseCurrency)}
      breakdown={breakdown}
      expanded={expanded}
      onToggle={onToggle}
      onPress={() => openLog(type, filter, range, by === "category" ? { category: group.id } : { tag: group.id })}
      onChildPress={(childId) =>
        openLog(type, filter, range, by === "category" ? { category: group.id, tag: childId } : { tag: group.id, category: childId })
      }
      limit={limit}
    />
  );
}
