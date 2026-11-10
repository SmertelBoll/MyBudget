import { useMemo, useState } from "react";
import { FlatList, Pressable, View } from "react-native";
import { router } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { countTagUses, useTagTree } from "@/data/tags";
import { useI18n } from "@/i18n/I18nProvider";
import { useTheme } from "@/theme/ThemeProvider";
import { radius, spacing } from "@/theme/tokens";
import { useBottomSpace } from "@/utils/useBottomSpace";
import { useDeleteTag } from "@/utils/useDeleteTag";
import { AppText } from "@/components/AppText";
import { Fab } from "@/components/Fab";
import { TAG_ICON } from "@/components/GroupRow";
import { IconButton } from "@/components/IconButton";
import { IconCircle } from "@/components/IconCircle";
import { ScreenHeader } from "@/components/ScreenHeader";
import { TextField } from "@/components/TextField";
import { HiddenSectionHeader } from "@/components/HiddenSectionHeader";
import type { Tag } from "@/data/types";

type Row = { kind: "tag"; tag: Tag; depth: 0 | 1; hidden: boolean } | { kind: "fold"; count: number };

// Spec 7.4: every tag with search, each top-level tag followed by its subtags; a tap opens the tag (name, parent,
// color), the bin deletes it (taken off all transactions). Tags are shared by expenses and income.
export default function TagsScreen() {
  const { colors } = useTheme();
  const bottomSpace = useBottomSpace();
  const { t } = useI18n();
  const tree = useTagTree();
  const remove = useDeleteTag();
  const [query, setQuery] = useState("");
  // Hidden tags (and subtags of hidden ones) form their own block at the end.
  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const matches = ({ tag }: { tag: Tag }) => !needle || tag.name.toLowerCase().includes(needle);
    const shown: Row[] = tree.ordered
      .filter((item) => !tree.isHidden(item.tag.id) && matches(item))
      .map(({ tag, depth }) => ({ kind: "tag", tag, depth, hidden: false }));
    const hidden: Row[] = tree.ordered
      .filter((item) => tree.isHidden(item.tag.id) && matches(item))
      // A hidden subtag of a shown tag stands on its own there.
      .map(({ tag, depth }) => {
        const parent = tree.parentOf(tag.id);
        return { kind: "tag", tag, depth: depth && parent && tree.isHidden(parent) ? 1 : 0, hidden: true };
      });
    if (!hidden.length) return shown;
    return [...shown, { kind: "fold", count: hidden.length } as Row, ...hidden];
  }, [tree, query]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title={t("tags.title")} left="back" />
      <FlatList
        data={rows}
        keyExtractor={(row) => (row.kind === "fold" ? "--hidden--" : row.tag.id)}
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
        renderItem={({ item }) => {
          if (item.kind === "fold")
            return <HiddenSectionHeader count={item.count} />;
          const { tag, depth, hidden } = item;
          const subtags = tree.children.get(tag.id)?.length ?? 0;
          return (
            // The row and the delete button are siblings: a button inside a button isn't allowed (and confuses
            // screen readers).
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                marginLeft: depth ? spacing.xl : 0,
                borderRadius: radius.md,
                backgroundColor: colors.surface,
                overflow: "hidden",
                opacity: hidden ? 0.6 : 1,
              }}
            >
              <Pressable
                onPress={() => router.push({ pathname: "/tag/[id]", params: { id: tag.id } })}
                accessibilityRole="button"
                accessibilityHint={t("tags.edit")}
                style={({ pressed }) => ({
                  flex: 1,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.md,
                  minHeight: 56,
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.sm,
                  backgroundColor: pressed ? colors.selected : "transparent",
                })}
              >
                <IconCircle icon={TAG_ICON} color={tree.colorOf(tag.id)} size={depth ? 32 : 40} />
                <View style={{ flex: 1, gap: 2 }}>
                  <AppText variant="heading" numberOfLines={1}>
                    {tag.name}
                  </AppText>
                  <AppText variant="caption" secondary numberOfLines={1}>
                    {[t("tags.uses", { count: countTagUses(tag.id) }), subtags ? t("tags.subtagCount", { count: subtags }) : null]
                      .filter(Boolean)
                      .join(" · ")}
                  </AppText>
                </View>
              </Pressable>
              <View style={{ paddingRight: spacing.sm }}>
                <IconButton icon="trash-can-outline" label={t("common.delete")} size={36} onPress={() => remove(tag)} />
              </View>
            </View>
          );
        }}
      />
      <Fab label={t("tags.add")} onPress={() => router.push({ pathname: "/tag/[id]", params: { id: "new" } })} />
    </View>
  );
}
