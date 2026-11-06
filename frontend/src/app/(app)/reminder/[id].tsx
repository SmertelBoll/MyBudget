import { useMemo, useState } from "react";
import { Platform, Pressable, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { KEYBOARD_GAP } from "@/utils/keyboard";
import { useLocalSearchParams } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRecord } from "@/data/hooks";
import { deleteReminder, saveReminder } from "@/data/recurring";
import { reportWriteError } from "@/data/store";
import type { RepeatRule } from "@/data/types";
import { useI18n } from "@/i18n/I18nProvider";
import { requestNotificationPermission } from "@/notifications/notifications";
import { useTheme } from "@/theme/ThemeProvider";
import { spacing } from "@/theme/tokens";
import { toLocalDate } from "@/utils/dates";
import { useBottomSpace } from "@/utils/useBottomSpace";
import { useUnsavedGuard } from "@/utils/useUnsavedGuard";
import { useDialog } from "@/components/AppDialog";
import { BottomActionButton } from "@/components/BottomActionButton";
import { DateField } from "@/components/DateField";
import { RepeatPicker } from "@/components/RepeatPicker";
import { ScreenHeader } from "@/components/ScreenHeader";
import { TextField } from "@/components/TextField";
import { TimeField, isValidTime, timeOrDefault } from "@/components/TimeField";
import { useToast } from "@/components/Toast";
import { ToggleRow } from "@/components/ToggleRow";

// A new reminder starts at the next full hour, so a one-time one isn't already over when it's saved.
const nextHour = () => {
  const at = new Date(Date.now() + 60 * 60 * 1000);
  return { date: toLocalDate(at), time: `${String(at.getHours()).padStart(2, "0")}:00` };
};

// defaultTime: what an empty time field means (shown faintly).
type FormValues = { title: string; rule: RepeatRule; startDate: string; time: string; defaultTime: string; comment: string; active: boolean };

// Screen 9: create ("new") and edit share one form: title, repeat, date and time, comment, "Active".
export default function ReminderFormScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const existing = useRecord("reminders", id === "new" ? null : id);
  const [initial] = useState<FormValues>(() => ({
    title: existing?.title ?? "",
    rule: existing?.rule ?? { kind: "once" },
    startDate: existing?.startDate ?? nextHour().date,
    time: existing?.time ?? "",
    defaultTime: nextHour().time,
    comment: existing?.comment ?? "",
    active: existing?.active ?? true,
  }));
  if (id !== "new" && !existing) return null;
  return <ReminderForm initial={initial} existingId={existing?.id ?? null} />;
}

function ReminderForm({ initial, existingId }: { initial: FormValues; existingId: string | null }) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const dialog = useDialog();
  const toast = useToast();
  const bottomSpace = useBottomSpace();
  const existing = useRecord("reminders", existingId);

  const [values, setValues] = useState(initial);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof FormValues>(key: K, value: FormValues[K]) => setValues((current) => ({ ...current, [key]: value }));
  const dirty = useMemo(() => JSON.stringify(values) !== JSON.stringify(initial), [values, initial]);
  const leave = useUnsavedGuard(dirty && !saving);

  const errors = {
    title: !values.title.trim() ? t("recurring.nameRequired") : null,
    time: values.time && !isValidTime(values.time) ? t("common.required") : null,
  };
  const invalid = Object.values(errors).some(Boolean);
  const show = (error: string | null) => (submitted && error ? error : undefined);

  const save = async () => {
    setSubmitted(true);
    if (invalid) return;
    setSaving(true);
    const { defaultTime, ...fields } = values;
    saveReminder(
      { ...fields, time: timeOrDefault(values.time, defaultTime), title: values.title.trim(), comment: values.comment.trim() },
      existing
    ).catch(reportWriteError);
    if (values.active && !(await requestNotificationPermission()) && Platform.OS !== "web") {
      toast.show(t("recurring.notificationsOff"), { kind: "error" });
    }
    leave();
  };

  const remove = async () => {
    if (!existing) return;
    const ok = await dialog.confirm({ title: t("reminders.deleteTitle"), confirmText: t("common.delete"), destructive: true });
    if (!ok) return;
    setSaving(true);
    deleteReminder(existing.id).catch(reportWriteError);
    leave();
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader
        title={t(existing ? "reminders.edit" : "reminders.add")}
        left="back"
        right={
          existing ? (
            <Pressable onPress={remove} hitSlop={8} accessibilityRole="button" accessibilityLabel={t("common.delete")} style={{ padding: spacing.sm }}>
              <MaterialCommunityIcons name="trash-can-outline" size={26} color={colors.text} />
            </Pressable>
          ) : undefined
        }
      />
      <KeyboardAwareScrollView bottomOffset={KEYBOARD_GAP} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: spacing.md, gap: spacing.lg, paddingBottom: bottomSpace }}>
          <TextField
            label={t("reminders.name")}
            value={values.title}
            onChangeText={(text) => set("title", text)}
            placeholder={t("reminders.name")}
            maxLength={50}
            error={show(errors.title)}
          />
          <ToggleRow label={t("reminders.active")} value={values.active} onChange={(on) => set("active", on)} />
          <RepeatPicker value={values.rule} onChange={(rule) => set("rule", rule)} startDate={values.startDate} time={timeOrDefault(values.time, values.defaultTime)} />
          <DateField
            label={t(values.rule.kind === "once" ? "recurring.date" : "recurring.startDate")}
            value={values.startDate}
            onChange={(date) => set("startDate", date)}
          />
          <TimeField
            label={t("recurring.time")}
            value={values.time}
            onChange={(time) => set("time", time)}
            error={show(errors.time)}
            placeholder={values.defaultTime}
          />
          <TextField
            label={t("transfers.comment")}
            value={values.comment}
            onChangeText={(text) => set("comment", text)}
            placeholder={t("transfers.comment")}
            maxLength={500}
            multiline
          />
        </KeyboardAwareScrollView>
      <BottomActionButton title={t(existing ? "common.save" : "common.add")} onPress={save} loading={saving} muted={invalid} />
    </View>
  );
}
