import { useMemo, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import type { EntryType } from "@/api/types";
import { categoryName, countCategoryEntries, deleteCategory, saveCategory } from "@/data/categories";
import { useRecord } from "@/data/hooks";
import { reportWriteError } from "@/data/store";
import { DEFAULT_CATEGORY_ICON, DEFAULT_COLOR, EXPENSE_ICON_SECTIONS, INCOME_ICON_SECTIONS } from "@/constants/appearance";
import { useI18n } from "@/i18n/I18nProvider";
import { useTheme } from "@/theme/ThemeProvider";
import { radius, spacing } from "@/theme/tokens";
import { parseAmount } from "@/utils/money";
import { useBottomSpace } from "@/utils/useBottomSpace";
import { useMoney } from "@/utils/useMoney";
import { useUnsavedGuard } from "@/utils/useUnsavedGuard";
import { useDialog } from "@/components/AppDialog";
import { AmountInput } from "@/components/AmountInput";
import { AppText } from "@/components/AppText";
import { BottomActionButton } from "@/components/BottomActionButton";
import { ColorPicker } from "@/components/ColorPicker";
import { IconButton } from "@/components/IconButton";
import { IconCircle } from "@/components/IconCircle";
import { IconPicker } from "@/components/IconPicker";
import { ScreenHeader } from "@/components/ScreenHeader";
import { SegmentedSwitch } from "@/components/SegmentedSwitch";
import { TextField } from "@/components/TextField";

type FormValues = {
  name: string;
  type: EntryType;
  limit: string;
  icon: string;
  color: string;
};

// Screen 7.2: create ("new", ?type=expense|income from the list it was opened from) and edit share one form.
export default function CategoryFormScreen() {
  const { id, type } = useLocalSearchParams<{ id: string; type?: EntryType }>();
  const existing = useRecord("categories", id === "new" ? null : id);
  const { t } = useI18n();
  const { toInput } = useMoney();

  const [initial] = useState<FormValues>(() => {
    const startType: EntryType = existing?.type ?? (type === "income" ? "income" : "expense");
    return {
      name: existing ? categoryName(existing, t) : "",
      type: startType,
      limit: existing?.plannedMonthly ? toInput(existing.plannedMonthly) : "",
      icon: existing?.icon ?? DEFAULT_CATEGORY_ICON[startType],
      color: existing?.color ?? DEFAULT_COLOR,
    };
  });

  if (id !== "new" && !existing) return null;
  return <CategoryForm initial={initial} existingId={existing?.id ?? null} />;
}

function CategoryForm({ initial, existingId }: { initial: FormValues; existingId: string | null }) {
  const { colors } = useTheme();
  const bottomSpace = useBottomSpace();
  const { t } = useI18n();
  const dialog = useDialog();
  const { baseCurrency } = useMoney();
  const existing = useRecord("categories", existingId);
  const locked = Boolean(existing?.isSystemOther);

  const [values, setValues] = useState(initial);
  const [submitted, setSubmitted] = useState(false);
  const [touchedName, setTouchedName] = useState(false);
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof FormValues>(key: K, value: FormValues[K]) =>
    setValues((current) => ({ ...current, [key]: value }));

  const dirty = useMemo(() => (Object.keys(initial) as (keyof FormValues)[]).some((key) => values[key] !== initial[key]), [values, initial]);
  const leave = useUnsavedGuard(dirty && !saving);

  // Empty limit = no limit (spec 7.2, optional).
  const limit = values.limit.trim() ? parseAmount(values.limit) : null;
  const nameError = !values.name.trim() ? t("categories.nameRequired") : null;
  const limitError = values.limit.trim() && (limit === null || limit <= 0) ? t("amount.mustBePositive") : null;
  const showNameError = (touchedName || submitted) && nameError;

  const save = () => {
    setSubmitted(true);
    if (nameError || limitError) return;
    setSaving(true);
    const translated = existing?.nameKey ? t(existing.nameKey) : null;
    saveCategory(
      { name: values.name.trim(), type: values.type, icon: values.icon, color: values.color, plannedMonthly: limit },
      translated,
      existing
    ).catch(reportWriteError);
    leave();
  };

  // Spec 7.3: confirm, warning that its entries move to "Other".
  const remove = async () => {
    if (!existing || existing.isSystemOther) return;
    const entries = countCategoryEntries(existing.id);
    const ok = await dialog.confirm({
      title: t("categories.deleteTitle"),
      message: t("categories.deleteMessage", { count: entries }),
      confirmText: t("common.delete"),
      destructive: true,
    });
    if (!ok) return;
    setSaving(true);
    deleteCategory(existing).catch(reportWriteError);
    leave();
  };

  // Changing the type of a new category swaps a still-default icon for the other type's default.
  const changeType = (type: EntryType) =>
    setValues((current) => ({
      ...current,
      type,
      icon: current.icon === DEFAULT_CATEGORY_ICON[current.type] ? DEFAULT_CATEGORY_ICON[type] : current.icon,
    }));

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader
        title={existing ? categoryName(existing, t) : t("categories.new")}
        left="back"
        right={
          existing && !existing.isSystemOther ? (
            <IconButton icon="trash-can-outline" label={t("common.delete")} onPress={remove} />
          ) : undefined
        }
      />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: spacing.md, gap: spacing.lg, paddingBottom: bottomSpace }}>
          {locked ? (
            // "Other" is the fallback for deleted categories: only its color can change.
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
              <IconCircle icon={values.icon} color={values.color} size={48} />
              <View style={{ flex: 1, gap: 2 }}>
                <AppText variant="title">{values.name}</AppText>
                <AppText variant="caption" secondary>
                  {t("categories.otherLocked")}
                </AppText>
              </View>
            </View>
          ) : (
            <View style={{ flexDirection: "row", alignItems: "flex-end", gap: spacing.md }}>
              <View style={{ paddingBottom: showNameError ? 22 : 2 }}>
                <IconCircle icon={values.icon} color={values.color} size={48} />
              </View>
              <View style={{ flex: 1 }}>
                <TextField
                  label={t("categories.name")}
                  value={values.name}
                  onChangeText={(text) => set("name", text)}
                  onBlur={() => setTouchedName(true)}
                  error={showNameError ? nameError : undefined}
                  maxLength={50}
                  autoFocus={!existing}
                />
              </View>
            </View>
          )}

          {locked ? null : existing ? (
            // The type can't change after creation (spec 7.2): shown as text.
            <View style={{ gap: spacing.xs }}>
              <AppText variant="label">{t("categories.type")}</AppText>
              <AppText secondary>{t(existing.type === "expense" ? "entries.expense" : "entries.incomeOne")}</AppText>
            </View>
          ) : (
            <View style={{ gap: spacing.xs }}>
              <AppText variant="label">{t("categories.type")}</AppText>
              <SegmentedSwitch
                options={[
                  { value: "expense", label: t("entries.expense") },
                  { value: "income", label: t("entries.incomeOne") },
                ]}
                value={values.type}
                onChange={changeType}
              />
            </View>
          )}

          {!locked && (
            <View style={{ backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, gap: spacing.xs }}>
              <AppText variant="label">{t("categories.limit")}</AppText>
              <AmountInput
                value={values.limit}
                onChangeText={(text) => set("limit", text)}
                currency={baseCurrency}
                placeholder={t("categories.noLimit")}
                error={limitError ?? undefined}
                size="normal"
              />
              <AppText variant="caption" secondary>
                {t("categories.limitHint")}
              </AppText>
            </View>
          )}

          {!locked && (
            <IconPicker
              label={t("accounts.icon")}
              sections={values.type === "expense" ? EXPENSE_ICON_SECTIONS : INCOME_ICON_SECTIONS}
              value={values.icon}
              color={values.color}
              onChange={(icon) => set("icon", icon)}
            />
          )}

          <ColorPicker label={t("accounts.color")} value={values.color} onChange={(color) => set("color", color)} />
        </ScrollView>
      </KeyboardAvoidingView>

      <BottomActionButton
        title={t(existing ? "common.save" : "common.add")}
        onPress={save}
        loading={saving}
        muted={Boolean(nameError || limitError)}
      />
    </View>
  );
}
