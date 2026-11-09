import { type ComponentRef, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, TextInput, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useCollection } from "@/data/hooks";
import { reportWriteError } from "@/data/store";
import { useRankedTags } from "@/data/tagRanking";
import { TAG_MAX_LENGTH, createTag, findTagByName, nextTagColor, useTagTree } from "@/data/tags";
import { useI18n } from "@/i18n/I18nProvider";
import { useTheme } from "@/theme/ThemeProvider";
import { fontSize, fonts, radius, spacing } from "@/theme/tokens";
import { useDialog } from "../AppDialog";
import { AppText, NO_LIGATURES } from "../AppText";
import { IconButton } from "../IconButton";

type ChipProps = { label: string; active?: boolean; onPress: () => void; icon?: "plus"; hidden?: boolean; color?: string };

function Chip({ label, active, onPress, icon, hidden, color }: ChipProps) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={icon ? "button" : "checkbox"}
      accessibilityState={icon ? undefined : { checked: Boolean(active) }}
      disabled={hidden}
      accessibilityElementsHidden={hidden}
      importantForAccessibility={hidden ? "no-hide-descendants" : "auto"}
      style={({ pressed }) => ({
        opacity: hidden ? 0 : 1,
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: radius.md,
        borderWidth: 1.5,
        borderColor: active ? colors.accent : colors.selected,
        backgroundColor: active ? colors.accent : pressed ? colors.selected : "transparent",
      })}
    >
      {icon && <MaterialCommunityIcons name={icon} size={18} color={colors.text} />}
      {color && <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color, borderWidth: active ? 1 : 0, borderColor: colors.onAccent }} />}
      <AppText variant="label" color={active ? colors.onAccent : colors.text}>
        {label}
      </AppText>
    </Pressable>
  );
}

const HEADER_HEIGHT = 40;

// Spec 4.6: tags as chips in two rows that scroll sideways; the last chip adds a tag. The magnifier opens a filter
// field; "Add tag" is never filtered out and starts with what was typed. A new tag is selected at once.
// Time for the form to scroll the tags up before the keyboard opens: focusing at once makes Android jump the screen
// to the field instead.
const FOCUS_DELAY_MS = 300;

export function TagChips({
  value,
  onChange,
  onSearchOpen,
  categoryId = null,
}: {
  // The chosen category: its most used recent tags come first (with none, the whole app's).
  categoryId?: string | null;
  value: string[];
  onChange: (tagIds: string[]) => void;
  // Lets the form bring this block into view first.
  onSearchOpen?: () => void;
}) {
  const { colors } = useTheme();
  const { t, lang } = useI18n();
  const dialog = useDialog();
  const tags = useCollection("tags");
  const tagTree = useTagTree();
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<ComponentRef<typeof TextInput>>(null);

  useEffect(() => {
    if (!searching) return;
    const timer = setTimeout(() => inputRef.current?.focus(), FOCUS_DELAY_MS);
    return () => clearTimeout(timer);
  }, [searching]);

  const ranked = useRankedTags(tags, categoryId, lang);
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    // Chosen tags first, so they're visible without scrolling.
    const sorted = [...ranked].sort((a, b) => Number(value.includes(b.id)) - Number(value.includes(a.id)));
    return sorted.filter((tag) => !needle || tag.name.toLowerCase().includes(needle));
  }, [ranked, query, value]);

  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((tagId) => tagId !== id) : [...value, id]);

  const add = async () => {
    const name = await dialog.prompt({
      title: t("tags.add"),
      label: t("tags.name"),
      initial: query.trim().slice(0, TAG_MAX_LENGTH),
      maxLength: TAG_MAX_LENGTH,
      confirmText: t("common.add"),
      validate: (text) => (findTagByName(text) ? t("tag.duplicate") : null),
    });
    if (!name) return;
    const tag = await createTag(name, { color: nextTagColor(tagTree) }).catch((error) => {
      reportWriteError(error);
      return null;
    });
    if (tag) onChange([...value, tag.id]);
    setQuery("");
  };

  const chips = [
    ...visible.map((tag) => <Chip key={tag.id} label={tag.name} color={tagTree.colorOf(tag.id)} active={value.includes(tag.id)} onPress={() => toggle(tag.id)} />),
    <Chip key="--add--" label={t("tags.add")} icon="plus" onPress={add} />,
  ];
  // Two rows: chips alternate between them, so both rows grow at the same pace.
  const rows = [chips.filter((_, index) => index % 2 === 0), chips.filter((_, index) => index % 2 === 1)];
  // While filtering the second row may empty out: an invisible chip keeps its height, so nothing below moves.
  if (!rows[1].length) rows[1].push(<Chip key="--spacer--" label=" " hidden onPress={() => {}} />);

  return (
    <View style={{ gap: spacing.sm }}>
      {/* Fixed height: switching between the title and the search field must not shift the form. */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, height: HEADER_HEIGHT }}>
        {searching ? (
          <TextInput
            ref={inputRef}
            value={query}
            onChangeText={setQuery}
            placeholder={t("tags.search")}
            placeholderTextColor={colors.textSecondary}
            style={{
              flex: 1,
              height: HEADER_HEIGHT,
              color: colors.text,
              fontFamily: fonts.regular,
              fontSize: fontSize.body,
              fontVariant: NO_LIGATURES,
              paddingVertical: 0,
              borderBottomWidth: 2,
              borderBottomColor: colors.selected,
            }}
          />
        ) : (
          <AppText variant="label" style={{ flex: 1 }}>
            {t("tags.title")}
          </AppText>
        )}
        <IconButton
          icon={searching ? "close" : "magnify"}
          label={t(searching ? "common.close" : "tags.search")}
          size={36}
          onPress={() => {
            if (!searching) onSearchOpen?.();
            setSearching(!searching);
            setQuery("");
          }}
        />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={{ gap: spacing.sm }}>
          {rows.map((row, index) => (
            <View key={index} style={{ flexDirection: "row", gap: spacing.sm }}>
              {row}
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
