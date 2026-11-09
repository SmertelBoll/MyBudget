import { useDialog } from "@/components/AppDialog";
import { reportWriteError } from "@/data/store";
import { countTagUses, deleteTag, useTagTree } from "@/data/tags";
import type { Tag } from "@/data/types";
import { useI18n } from "@/i18n/I18nProvider";

// Spec 7.4: confirm, saying how many entries lose the tag (and that its subtags become top-level tags). Resolves to
// whether it was deleted.
export const useDeleteTag = () => {
  const { t } = useI18n();
  const dialog = useDialog();
  const tree = useTagTree();
  return async (tag: Tag) => {
    const hasChildren = Boolean(tree.children.get(tag.id)?.length);
    const message = t("tags.deleteMessage", { count: countTagUses(tag.id) });
    const ok = await dialog.confirm({
      title: t("tags.deleteTitle", { name: tag.name }),
      message: hasChildren ? `${message}. ${t("tags.deleteChildren")}` : message,
      confirmText: t("common.delete"),
      destructive: true,
    });
    if (ok) deleteTag(tag).catch(reportWriteError);
    return ok;
  };
};
