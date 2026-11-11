import { useMemo } from "react";
import { router } from "expo-router";
import type { EntryType } from "@/api/types";
import { categoryName } from "@/data/categories";
import { useCollection } from "@/data/hooks";
import { DEFAULT_INNER, NO_TAG, type AccountFilter, type Group, type Inner } from "@/data/stats";
import { useTagTree } from "@/data/tags";
import { useI18n } from "@/i18n/I18nProvider";
import { useTheme } from "@/theme/ThemeProvider";
import type { PeriodRange } from "@/utils/periods";
import type { MoneyKind } from "@/utils/money";
import { useMoney } from "@/utils/useMoney";
import { StatsRow, type StatsChild } from "./StatsRow";

// A tag's color is its own, else its parent's (TagTree.colorOf); "no tag" has its own. A row's icon and its part of
// a chart always use the same color.
export const NO_TAG_COLOR = "#6D7FA3";
export const TAG_ICON = "pound";
export const NO_TAG_ICON = "tag-off-outline";

export type GroupBy = "category" | "tag";

// Opens the log (spec 11) for these accounts, type and period, optionally narrowed to one category and / or tag.
// A top-level tag brings its subtags along; exactTag: only entries with that tag and none of its subtags.
export const logsParams = (
  type: EntryType,
  filter: AccountFilter,
  range: PeriodRange,
  { exactTag, ...only }: { category?: string; tag?: string; exactTag?: boolean } = {}
) => ({
  type,
  accounts: filter?.join(",") ?? "",
  kind: range.kind,
  start: range.start,
  end: range.end,
  ...only,
  ...(exactTag ? { exact: "1" } : {}),
});

export const openLog = (
  type: EntryType,
  filter: AccountFilter,
  range: PeriodRange,
  only?: { category?: string; tag?: string; exactTag?: boolean }
) =>
  router.push({ pathname: "/logs", params: logsParams(type, filter, range, only) });

// Icon, color and name of a category or tag group (Home, Charts).
export const useGroupLook = (by: GroupBy) => {
  const { colors } = useTheme();
  const { t } = useI18n();
  const categories = useCollection("categories");
  const tree = useTagTree();
  const categoryById = useMemo(() => new Map(categories.map((category) => [category.id, category])), [categories]);

  const tagLook = (id: string) => {
    const tag = tree.byId.get(id);
    return { icon: tag ? TAG_ICON : NO_TAG_ICON, color: tag ? tree.colorOf(id) : NO_TAG_COLOR, title: tag?.name ?? t("home.noTag") };
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
  // Inside a row: categories of a tag; subtags of a tag (its own id: entries with none of them); or tags of a
  // category, top-level or most detailed (a subtag reads "Parent › Subtag", a tag that has subtags "Tag without
  // subtags").
  const childLook = (group: Group, id: string, inner: Inner) => {
    if (group.childBy === "category") return categoryLook(id);
    if (by === "tag") return id === group.id ? { ...tagLook(id), title: t("tags.noSubtag") } : tagLook(id);
    if (inner !== "subtag") return tagLook(id);
    const parent = tree.parentOf(id);
    if (parent) return { ...tagLook(id), title: `${tagLook(parent).title} › ${tagLook(id).title}` };
    if (tree.children.get(id)?.length) return { ...tagLook(id), title: t("tags.ownOnly", { name: tagLook(id).title }) };
    return tagLook(id);
  };
  return { look, childLook };
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
  moneyKind = "total",
  inner = DEFAULT_INNER[by],
}: {
  group: Group;
  by: GroupBy;
  type: EntryType;
  filter: AccountFilter;
  range: PeriodRange;
  expanded: boolean;
  onToggle: () => void;
  // Which Cents switch its amounts follow: Home has its own.
  moneyKind?: MoneyKind;
  // What the row opens into (the grouping's `inner`).
  inner?: Inner;
}) {
  const { t } = useI18n();
  const { money, baseCurrency } = useMoney();
  const { look, childLook } = useGroupLook(by);
  const tree = useTagTree();
  const { icon, color, title } = look(group.id);

  // A category whose entries have no tags has nothing to open.
  const onlyNoTag = by === "category" && group.children.every((child) => child.id === NO_TAG);
  const breakdown: StatsChild[] = onlyNoTag
    ? []
    : group.children.map((child) => {
        const childLooks = childLook(group, child.id, inner);
        return { id: child.id, icon: childLooks.icon, color: childLooks.color, title: childLooks.title, amount: money(child.amount, baseCurrency, moneyKind) };
      });

  const planned = by === "category" && range.kind === "month" ? (look(group.id) as { plannedMonthly?: number | null }).plannedMonthly : null;
  const limit = planned
    ? {
        used: group.amount / planned,
        text: t("home.planned", { spent: money(group.amount, baseCurrency, moneyKind), planned: money(planned, baseCurrency, moneyKind) }),
      }
    : undefined;

  return (
    <StatsRow
      icon={icon}
      color={color}
      title={title}
      share={group.share}
      amount={money(group.amount, baseCurrency, moneyKind)}
      breakdown={breakdown}
      expanded={expanded}
      onToggle={onToggle}
      onPress={() => openLog(type, filter, range, by === "category" ? { category: group.id } : { tag: group.id })}
      onChildPress={(childId) =>
        openLog(
          type,
          filter,
          range,
          by === "category"
            ? // A tag that has subtags, as its own line among subtags: only entries with none of them.
              { category: group.id, tag: childId, exactTag: inner === "subtag" && Boolean(tree.children.get(childId)?.length) }
            : group.childBy === "tag"
              ? { tag: childId, exactTag: childId === group.id }
              : { tag: group.id, category: childId }
        )
      }
      limit={limit}
    />
  );
}
