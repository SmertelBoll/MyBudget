import { useMemo, useState } from "react";
import { View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useLocalSearchParams } from "expo-router";
import { useRecord } from "@/data/hooks";
import { reportWriteError } from "@/data/store";
import { TAG_MAX_LENGTH, createTag, findTagByName, nextTagColor, updateTag, useTagTree } from "@/data/tags";
import { useI18n } from "@/i18n/I18nProvider";
import { useTheme } from "@/theme/ThemeProvider";
import { spacing } from "@/theme/tokens";
import { KEYBOARD_GAP } from "@/utils/keyboard";
import { useBottomSpace } from "@/utils/useBottomSpace";
import { useDeleteTag } from "@/utils/useDeleteTag";
import { useUnsavedGuard } from "@/utils/useUnsavedGuard";
import { AppText } from "@/components/AppText";
import { BottomActionButton } from "@/components/BottomActionButton";
import { ColorPicker } from "@/components/ColorPicker";
import { TAG_ICON } from "@/components/GroupRow";
import { IconButton } from "@/components/IconButton";
import { IconCircle } from "@/components/IconCircle";
import { ScreenHeader } from "@/components/ScreenHeader";
import { TextField } from "@/components/TextField";
import { ChoiceField } from "@/components/settings/PickerFields";

type FormValues = { name: string; parentId: string; color: string };

const NO_PARENT = "";

// Spec 7.4: a tag's name, its parent (a subtag belongs to one top-level tag) and its color. "new" creates one.
export default function TagFormScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const existing = useRecord("tags", id === "new" ? null : id);
  const tree = useTagTree();
  const [initial] = useState<FormValues>(() => ({
    name: existing?.name ?? "",
    parentId: (existing && tree.parentOf(existing.id)) ?? NO_PARENT,
    color: existing ? tree.colorOf(existing.id) : nextTagColor(tree),
  }));
  if (id !== "new" && !existing) return null;
  return <TagForm initial={initial} existingId={existing?.id ?? null} />;
}

function TagForm({ initial, existingId }: { initial: FormValues; existingId: string | null }) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const bottomSpace = useBottomSpace();
  const existing = useRecord("tags", existingId);
  const tree = useTagTree();
  const remove = useDeleteTag();

  const [values, setValues] = useState(initial);
  // Until the color is picked by hand it follows the chosen parent.
  const [colorTouched, setColorTouched] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);

  const dirty = useMemo(() => (Object.keys(initial) as (keyof FormValues)[]).some((key) => values[key] !== initial[key]), [values, initial]);
  const leave = useUnsavedGuard(dirty && !saving);

  const nameError = !values.name.trim()
    ? t("accounts.nameRequired")
    : findTagByName(values.name, existingId ?? undefined)
      ? t("tag.duplicate")
      : null;
  // A tag with subtags stays top-level (one level only).
  const hasChildren = Boolean(existingId && tree.children.get(existingId)?.length);
  const parentOptions = [
    { value: NO_PARENT, label: t("tags.noParent") },
    ...tree.ordered
      .filter(({ tag, depth }) => depth === 0 && tag.id !== existingId)
      .map(({ tag }) => ({ value: tag.id, label: tag.name })),
  ];

  const changeParent = (parentId: string) =>
    setValues((current) => ({
      ...current,
      parentId,
      color: colorTouched ? current.color : parentId ? tree.colorOf(parentId) : existing && !existing.parentId ? initial.color : nextTagColor(tree),
    }));

  const save = () => {
    setSubmitted(true);
    if (nameError) return;
    setSaving(true);
    const parentId = values.parentId || null;
    // A subtag in its parent's color keeps following it; an untouched color of an existing tag stays as stored.
    const color =
      parentId && values.color === tree.colorOf(parentId)
        ? null
        : existing && values.color === initial.color
          ? (existing.color ?? null)
          : values.color;
    (existing ? updateTag(existing, { name: values.name, color, parentId }) : createTag(values.name, { color, parentId })).catch(reportWriteError);
    leave();
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader
        title={existing ? existing.name : t("tags.add")}
        left="back"
        right={
          existing ? (
            <IconButton
              icon="trash-can-outline"
              label={t("common.delete")}
              onPress={async () => {
                if (await remove(existing)) {
                  setSaving(true);
                  leave();
                }
              }}
            />
          ) : undefined
        }
      />
      <KeyboardAwareScrollView
        bottomOffset={KEYBOARD_GAP}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: spacing.md, gap: spacing.lg, paddingBottom: bottomSpace }}
      >
        <View style={{ flexDirection: "row", alignItems: "flex-end", gap: spacing.md }}>
          <View style={{ paddingBottom: submitted && nameError ? 22 : 2 }}>
            <IconCircle icon={TAG_ICON} color={values.color} size={48} />
          </View>
          <View style={{ flex: 1 }}>
            <TextField
              label={t("tags.name")}
              value={values.name}
              onChangeText={(name) => setValues((current) => ({ ...current, name }))}
              error={(submitted || values.name.trim()) && nameError ? nameError : undefined}
              maxLength={TAG_MAX_LENGTH}
              autoFocus={!existing}
            />
          </View>
        </View>

        {hasChildren ? (
          <View style={{ gap: spacing.xs }}>
            <AppText variant="label">{t("tags.parent")}</AppText>
            <AppText secondary>{t("tags.parentLocked")}</AppText>
          </View>
        ) : (
          <ChoiceField label={t("tags.parent")} value={values.parentId} options={parentOptions} onChange={changeParent} capitalize={false} />
        )}

        <ColorPicker
          label={t("accounts.color")}
          value={values.color}
          onChange={(color) => {
            setColorTouched(true);
            setValues((current) => ({ ...current, color }));
          }}
        />
      </KeyboardAwareScrollView>

      <BottomActionButton title={t(existing ? "common.save" : "common.add")} onPress={save} loading={saving} muted={Boolean(nameError)} />
    </View>
  );
}
