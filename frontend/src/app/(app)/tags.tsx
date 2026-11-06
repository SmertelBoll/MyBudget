import { useMemo, useState } from "react";
import { FlatList, Pressable, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useCollection } from "@/data/hooks";
import { reportWriteError } from "@/data/store";
import { TAG_MAX_LENGTH, countTagUses, createTag, deleteTag, findTagByName, renameTag, sortTags } from "@/data/tags";
import type { Tag } from "@/data/types";
import { useI18n } from "@/i18n/I18nProvider";
import { useTheme } from "@/theme/ThemeProvider";
import { radius, spacing } from "@/theme/tokens";
import { useBottomSpace } from "@/utils/useBottomSpace";
import { useDialog } from "@/components/AppDialog";
import { AppText } from "@/components/AppText";
import { Fab } from "@/components/Fab";
import { IconButton } from "@/components/IconButton";
import { ScreenHeader } from "@/components/ScreenHeader";
import { TextField } from "@/components/TextField";

// Spec 7.4: every tag with search; rename, delete (taken off all transactions), add. Tags are shared by expenses
// and income.
export default function TagsScreen() {
  const { colors } = useTheme();
  const bottomSpace = useBottomSpace();
  const { t, lang } = useI18n();
  const dialog = useDialog();
  const tags = useCollection("tags");
  const [query, setQuery] = useState("");

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return sortTags(tags, lang).filter((tag) => !needle || tag.name.toLowerCase().includes(needle));
  }, [tags, query, lang]);

  const uniqueName = (exceptId?: string) => (name: string) => (findTagByName(name, exceptId) ? t("tag.duplicate") : null);

  const add = async () => {
    const name = await dialog.prompt({
      title: t("tags.add"),
      label: t("tags.name"),
      initial: query.trim().slice(0, TAG_MAX_LENGTH),
      maxLength: TAG_MAX_LENGTH,
      confirmText: t("common.add"),
      validate: uniqueName(),
    });
    if (name) createTag(name).catch(reportWriteError);
  };

  const rename = async (tag: Tag) => {
    const name = await dialog.prompt({
      title: t("tags.rename"),
      label: t("tags.name"),
      initial: tag.name,
      maxLength: TAG_MAX_LENGTH,
      confirmText: t("common.save"),
      validate: uniqueName(tag.id),
    });
    if (name && name !== tag.name) renameTag(tag, name).catch(reportWriteError);
  };

  const remove = async (tag: Tag) => {
    const ok = await dialog.confirm({
      title: t("tags.deleteTitle", { name: tag.name }),
      message: t("tags.deleteMessage", { count: countTagUses(tag.id) }),
      confirmText: t("common.delete"),
      destructive: true,
    });
    if (ok) deleteTag(tag).catch(reportWriteError);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title={t("tags.title")} left="back" />
      <FlatList
        data={visible}
        keyExtractor={(tag) => tag.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: spacing.md, gap: spacing.sm, paddingBottom: bottomSpace }}
        ListHeaderComponent={
          <View style={{ marginBottom: spacing.sm }}>
            <TextField label={t("common.search")} value={query} onChangeText={setQuery} autoCapitalize="none" autoCorrect={false} />
          </View>
        }
        ListEmptyComponent={
          <View style={{ alignItems: "center", gap: spacing.sm, paddingVertical: spacing.xl }}>
            <MaterialCommunityIcons name="tag-outline" size={48} color={colors.textSecondary} />
            <AppText secondary style={{ textAlign: "center" }}>
              {t(query ? "common.nothingFound" : "tags.empty")}
            </AppText>
          </View>
        }
        renderItem={({ item }) => (
          // The row and the delete button are siblings: a button inside a button isn't allowed (and confuses
          // screen readers).
          <View style={{ flexDirection: "row", alignItems: "center", borderRadius: radius.md, backgroundColor: colors.surface, overflow: "hidden" }}>
            <Pressable
              onPress={() => rename(item)}
              accessibilityRole="button"
              accessibilityHint={t("tags.rename")}
              style={({ pressed }) => ({
                flex: 1,
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.md,
                minHeight: 56,
                paddingHorizontal: spacing.md,
                backgroundColor: pressed ? colors.selected : "transparent",
              })}
            >
              <MaterialCommunityIcons name="pound" size={20} color={colors.textSecondary} />
              <AppText variant="heading" style={{ flex: 1 }} numberOfLines={1}>
                {item.name}
              </AppText>
              <AppText variant="caption" secondary>
                {t("tags.uses", { count: countTagUses(item.id) })}
              </AppText>
            </Pressable>
            <View style={{ paddingRight: spacing.sm }}>
              <IconButton icon="trash-can-outline" label={t("common.delete")} size={36} onPress={() => remove(item)} />
            </View>
          </View>
        )}
      />
      <Fab label={t("tags.add")} onPress={add} />
    </View>
  );
}
