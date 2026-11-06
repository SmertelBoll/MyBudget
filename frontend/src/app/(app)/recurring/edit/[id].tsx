import { useMemo, useState } from "react";
import { Platform, Pressable, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { KEYBOARD_GAP } from "@/utils/keyboard";
import { useLocalSearchParams } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { EntryType } from "@/api/types";
import { useAuth } from "@/auth/AuthProvider";
import { useCollection, useRecord } from "@/data/hooks";
import { deleteRecurring, saveRecurring } from "@/data/recurring";
import { reportWriteError } from "@/data/store";
import type { RepeatRule } from "@/data/types";
import { useI18n } from "@/i18n/I18nProvider";
import { requestNotificationPermission } from "@/notifications/notifications";
import { useTheme } from "@/theme/ThemeProvider";
import { radius, spacing } from "@/theme/tokens";
import { formatLongDate, todayLocal } from "@/utils/dates";
import { parseAmount } from "@/utils/money";
import { useBottomSpace } from "@/utils/useBottomSpace";
import { useMoney } from "@/utils/useMoney";
import { useAfterFirstFrame } from "@/utils/useAfterFirstFrame";
import { useUnsavedGuard } from "@/utils/useUnsavedGuard";
import { AccountPicker } from "@/components/AccountPicker";
import { useDialog } from "@/components/AppDialog";
import { AmountInput } from "@/components/AmountInput";
import { AppText } from "@/components/AppText";
import { BottomActionButton } from "@/components/BottomActionButton";
import { CalendarModal } from "@/components/CalendarModal";
import { DateField } from "@/components/DateField";
import { CategoryChooser } from "@/components/entry/CategoryChooser";
import { TagChips } from "@/components/entry/TagChips";
import { RepeatPicker } from "@/components/RepeatPicker";
import { ScreenHeader } from "@/components/ScreenHeader";
import { SegmentedSwitch } from "@/components/SegmentedSwitch";
import { TextField } from "@/components/TextField";
import { TimeField, isValidTime, timeOrDefault } from "@/components/TimeField";
import { useToast } from "@/components/Toast";
import { ToggleRow } from "@/components/ToggleRow";

const DEFAULT_TIME = "09:00";

type FormValues = {
  type: EntryType;
  name: string;
  rule: RepeatRule;
  autoAdd: boolean;
  startDate: string;
  time: string;
  endDate: string | null;
  accountId: string | null;
  categoryId: string | null;
  amount: string;
  tagIds: string[];
  comment: string;
  notify: boolean;
};

// Optional end of a repeating payment: "No end" until a date is picked; the cross takes it away again.
function EndDateField({ value, onChange, min }: { value: string | null; onChange: (date: string | null) => void; min: string }) {
  const { colors } = useTheme();
  const { t, lang } = useI18n();
  const [open, setOpen] = useState(false);
  return (
    <View style={{ gap: spacing.xs }}>
      <AppText variant="label">{t("recurring.endDate")}</AppText>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
        <Pressable
          onPress={() => setOpen(true)}
          accessibilityRole="button"
          style={({ pressed }) => ({
            flex: 1,
            flexDirection: "row",
            alignItems: "center",
            minHeight: 48,
            paddingHorizontal: spacing.md,
            borderRadius: radius.md,
            borderWidth: 1.5,
            borderColor: colors.selected,
            backgroundColor: pressed ? colors.selected : colors.surface,
          })}
        >
          <AppText style={{ flex: 1 }} color={value ? colors.text : colors.textSecondary}>
            {value ? formatLongDate(value, lang) : t("recurring.noEnd")}
          </AppText>
          <MaterialCommunityIcons name="calendar-month-outline" size={22} color={colors.textSecondary} />
        </Pressable>
        {value && (
          <Pressable onPress={() => onChange(null)} hitSlop={8} accessibilityRole="button" accessibilityLabel={t("recurring.clearEnd")} style={{ padding: spacing.sm }}>
            <MaterialCommunityIcons name="close" size={22} color={colors.text} />
          </Pressable>
        )}
      </View>
      {open && <CalendarModal visible value={value ?? min} onClose={() => setOpen(false)} onChange={(date) => onChange(date)} />}
    </View>
  );
}

// Screen 8.3: create ("new", optionally ?type=income) and edit share one form.
export default function RecurringFormScreen() {
  const { id, type } = useLocalSearchParams<{ id: string; type?: EntryType }>();
  const existing = useRecord("recurring", id === "new" ? null : id);
  const { user } = useAuth();
  const accounts = useCollection("accounts");
  const { toInput } = useMoney();

  const [initial] = useState<FormValues>(() => {
    const fallbackAccount = user?.settings.defaultAccountId ?? accounts.find((account) => account.isActive)?.id ?? null;
    return {
      type: existing?.type ?? type ?? user?.settings.focus ?? "expense",
      name: existing?.name ?? "",
      rule: existing?.rule ?? { kind: "monthly" },
      autoAdd: existing?.autoAdd ?? true,
      startDate: existing?.startDate ?? todayLocal(),
      time: existing?.time ?? "",
      endDate: existing?.endDate ?? null,
      accountId: existing?.accountId ?? fallbackAccount,
      categoryId: existing?.categoryId ?? null,
      amount: existing ? toInput(existing.amount) : "",
      tagIds: existing?.tagIds ?? [],
      comment: existing?.comment ?? "",
      notify: existing?.notify ?? true,
    };
  });

  if (id !== "new" && !existing) return null;
  return <RecurringForm initial={initial} existingId={existing?.id ?? null} />;
}

function RecurringForm({ initial, existingId }: { initial: FormValues; existingId: string | null }) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const dialog = useDialog();
  const toast = useToast();
  const bottomSpace = useBottomSpace();
  const existing = useRecord("recurring", existingId);

  const [values, setValues] = useState(initial);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof FormValues>(key: K, value: FormValues[K]) => setValues((current) => ({ ...current, [key]: value }));

  const account = useRecord("accounts", values.accountId);
  const dirty = useMemo(() => JSON.stringify(values) !== JSON.stringify(initial), [values, initial]);
  const leave = useUnsavedGuard(dirty && !saving);
  // Fields below the fold are drawn a frame later, so the screen opens without waiting for them.
  const belowFold = useAfterFirstFrame();

  const amountMinor = parseAmount(values.amount);
  const once = values.rule.kind === "once";
  const errors = {
    name: !values.name.trim() ? t("recurring.nameRequired") : null,
    account: !values.accountId ? t("entry.accountRequired") : null,
    category: !values.categoryId ? t("entry.categoryRequired") : null,
    amount: !amountMinor || amountMinor <= 0 ? t("amount.mustBePositive") : null,
    time: values.time && !isValidTime(values.time) ? t("common.required") : null,
  };
  const invalid = Object.values(errors).some(Boolean);
  const show = (error: string | null) => (submitted && error ? error : undefined);

  const changeType = (next: EntryType) =>
    setValues((current) => (current.type === next ? current : { ...current, type: next, categoryId: null }));

  const toggleNotify = async (next: boolean) => {
    set("notify", next);
    if (next && !(await requestNotificationPermission()) && Platform.OS !== "web") {
      toast.show(t("recurring.notificationsOff"), { kind: "error" });
    }
  };

  const save = async () => {
    setSubmitted(true);
    if (invalid || !values.accountId || !values.categoryId || !amountMinor || !account) return;
    setSaving(true);
    saveRecurring(
      {
        type: values.type,
        name: values.name.trim(),
        rule: values.rule,
        autoAdd: values.autoAdd,
        startDate: values.startDate,
        time: timeOrDefault(values.time, DEFAULT_TIME),
        // A one-time payment has no end; an end before the start would mean "never".
        endDate: once || !values.endDate || values.endDate < values.startDate ? null : values.endDate,
        accountId: values.accountId,
        categoryId: values.categoryId,
        amount: amountMinor,
        currency: account.currency,
        tagIds: values.tagIds,
        comment: values.comment.trim(),
        notify: values.notify,
      },
      existing
    ).catch(reportWriteError);
    // Notifications are on by default: the system is asked on saving, not only when the switch is touched.
    if (values.notify && !(await requestNotificationPermission()) && Platform.OS !== "web") {
      toast.show(t("recurring.notificationsOff"), { kind: "error" });
    }
    leave();
  };

  const remove = async () => {
    if (!existing) return;
    const ok = await dialog.confirm({
      title: t("recurring.deleteTitle"),
      message: t("recurring.deleteMessage"),
      confirmText: t("common.delete"),
      destructive: true,
    });
    if (!ok) return;
    setSaving(true);
    deleteRecurring(existing.id).catch(reportWriteError);
    leave();
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader
        title={t(existing ? "recurring.edit" : "recurring.add")}
        left="back"
        right={
          existing ? (
            <Pressable onPress={remove} hitSlop={8} accessibilityRole="button" accessibilityLabel={t("common.delete")} style={{ padding: spacing.sm }}>
              <MaterialCommunityIcons name="trash-can-outline" size={26} color={colors.text} />
            </Pressable>
          ) : undefined
        }
      >
        <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.xs }}>
          <SegmentedSwitch
            options={[
              { value: "expense", label: t("entries.expense") },
              { value: "income", label: t("entries.incomeOne") },
            ]}
            value={values.type}
            onChange={changeType}
          />
        </View>
      </ScreenHeader>

      <KeyboardAwareScrollView bottomOffset={KEYBOARD_GAP} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: spacing.md, gap: spacing.lg, paddingBottom: bottomSpace }}>
          <TextField
            label={t("recurring.name")}
            value={values.name}
            onChangeText={(text) => set("name", text)}
            placeholder={t("recurring.name")}
            maxLength={50}
            error={show(errors.name)}
          />

          <RepeatPicker value={values.rule} onChange={(rule) => set("rule", rule)} startDate={values.startDate} time={timeOrDefault(values.time, DEFAULT_TIME)} />
          <ToggleRow label={t("recurring.autoAdd")} value={values.autoAdd} onChange={(next) => set("autoAdd", next)} />
          <ToggleRow label={t("recurring.notify")} value={values.notify} onChange={toggleNotify} />

          <DateField label={t(once ? "recurring.date" : "recurring.startDate")} value={values.startDate} onChange={(date) => set("startDate", date)} />
          <TimeField label={t("recurring.time")} value={values.time} onChange={(time) => set("time", time)} error={show(errors.time)} placeholder={DEFAULT_TIME} />
          {!once && <EndDateField value={values.endDate} onChange={(date) => set("endDate", date)} min={values.startDate} />}

          {belowFold && (
            <>
          <AccountPicker label={t("entry.account")} value={values.accountId} onChange={(accountId) => set("accountId", accountId)} error={show(errors.account)} />
          <CategoryChooser type={values.type} value={values.categoryId} onChange={(categoryId) => set("categoryId", categoryId)} error={show(errors.category)} />

          <View style={{ gap: spacing.xs }}>
            <AppText variant="label">{t("transfers.amount")}</AppText>
            <AmountInput
              value={values.amount}
              onChangeText={(text) => set("amount", text)}
              currency={account?.currency ?? ""}
              error={show(errors.amount)}
              size="normal"
            />
          </View>

          <TagChips value={values.tagIds} onChange={(tagIds) => set("tagIds", tagIds)} categoryId={values.categoryId} />
          <TextField
            label={t("transfers.comment")}
            value={values.comment}
            onChangeText={(text) => set("comment", text)}
            placeholder={t("transfers.comment")}
            maxLength={500}
          />
            </>
          )}
        </KeyboardAwareScrollView>

      <BottomActionButton title={t(existing ? "common.save" : "common.add")} onPress={save} loading={saving} muted={invalid} />
    </View>
  );
}
