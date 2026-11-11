import type { IconName } from "@/constants/appearance";
import { INNER_CHOICES, type Inner } from "@/data/stats";
import { useI18n } from "@/i18n/I18nProvider";
import { IconButton } from "./IconButton";
import type { GroupBy } from "./GroupRow";

const ICON: Record<Inner, IconName> = { tag: "pound", subtag: "file-tree-outline", category: "shape-outline" };

// The smaller round button next to Categories / Tags: what each row opens into. It shows the current choice (by
// category: tags or subtags; by tag: subtags or categories); a tap switches to the other one.
export function InnerSwitch({ by, value, onChange }: { by: GroupBy; value: Inner; onChange: (inner: Inner) => void }) {
  const { t } = useI18n();
  const [first, second] = INNER_CHOICES[by];
  const next = value === first ? second : first;
  return (
    <IconButton
      icon={ICON[value]}
      label={t("home.innerSwitch", { now: t(`home.inner.${value}`), next: t(`home.inner.${next}`) })}
      size={32}
      onPress={() => onChange(next)}
    />
  );
}
