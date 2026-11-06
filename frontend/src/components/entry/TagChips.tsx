import { useMemo, useState } from "react";
import { Pressable, ScrollView, TextInput, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useCollection } from "@/data/hooks";
import { reportWriteError } from "@/data/store";
import { TAG_MAX_LENGTH, createTag, findTagByName, sortTags } from "@/data/tags";
import { useI18n } from "@/i18n/I18nProvider";
import { useTheme } from "@/theme/ThemeProvider";
import { fontSize, fonts, radius, spacing } from "@/theme/tokens";
import { useDialog } from "../AppDialog";
import { AppText, NO_LIGATURES } from "../AppText";
import { IconButton } from "../IconButton";

function Chip({ label, active, onPress, icon }: { label: string; active?: boolean; onPress: () => void; icon?: "plus" }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={icon ? "button" : "checkbox"}
      accessibilityState={icon ? undefined : { checked: Boolean(active) }}
      style={({ pressed }) => ({
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
      <AppText variant="label" color={active ? colors.onAccent : colors.text}>
        {label}
      </AppText>
    </Pressable>
  );
}

// Spec 4.6: tags as chips in two rows that scroll sideways; the last chip adds a tag. The magnifier opens a filter
// field; "Add tag" is never filtered out and starts with what was typed. A new tag is selected at once.
export function TagChips({ value, onChange }: { value: string[]; onChange: (tagIds: string[]) => void }) {
  const { colors } = useTheme();
  const { t, lang } = useI18n();
  const dialog = useDialog();
  const tags = useCollection("tags");
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState("");

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    // Chosen tags first, so they're visible without scrolling.
    const sorted = sortTags(tags, lang).sort((a, b) => Number(value.includes(b.id)) - Number(value.includes(a.id)));
    return sorted.filter((tag) => !needle || tag.name.toLowerCase().includes(needle));
  }, [tags, query, lang, value]);

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
    const tag = await createTag(name).catch((error) => {
      reportWriteError(error);
      return null;
    });
    if (tag) onChange([...value, tag.id]);
    setQuery("");
  };

  const chips = [
    ...visible.map((tag) => <Chip key={tag.id} label={tag.name} active={value.includes(tag.id)} onPress={() => toggle(tag.id)} />),
    <Chip key="--add--" label={t("tags.add")} icon="plus" onPress={add} />,
  ];
  // Two rows: chips alternate between them, so both rows grow at the same pace.
  const rows = [chips.filter((_, index) => index % 2 === 0), chips.filter((_, index) => index % 2 === 1)];

  return (
    <View style={{ gap: spacing.sm }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, minHeight: 40 }}>
        {searching ? (
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t("tags.search")}
            placeholderTextColor={colors.textSecondary}
            autoFocus
            style={{
              flex: 1,
              color: colors.text,
              fontFamily: fonts.regular,
              fontSize: fontSize.body,
              fontVariant: NO_LIGATURES,
              paddingVertical: spacing.xs,
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
            setSearching((current) => !current);
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
