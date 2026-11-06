import { useMemo, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRecord } from "@/data/hooks";
import { rateBetween, useRates } from "@/data/rates";
import { deleteTransfer, saveTransfer } from "@/data/transfers";
import { useI18n } from "@/i18n/I18nProvider";
import { useTheme } from "@/theme/ThemeProvider";
import { BOTTOM_ACTION_SPACE, spacing } from "@/theme/tokens";
import { todayLocal } from "@/utils/dates";
import { parseAmount } from "@/utils/money";
import { useMoney } from "@/utils/useMoney";
import { useUnsavedGuard } from "@/utils/useUnsavedGuard";
import { AccountPicker } from "@/components/AccountPicker";
import { useDialog } from "@/components/AppDialog";
import { AmountInput } from "@/components/AmountInput";
import { AmountPair, resolvePair } from "@/components/AmountPair";
import { AppText } from "@/components/AppText";
import { BottomActionButton } from "@/components/BottomActionButton";
import { DateField } from "@/components/DateField";
import { ScreenHeader } from "@/components/ScreenHeader";
import { TextField } from "@/components/TextField";

type FormValues = {
  from: string | null;
  to: string | null;
  amountFrom: string;
  amountTo: string;
  date: string;
  comment: string;
};

// Screen 10: create ("new", optionally ?from=<account id>) and edit share one form.
export default function TransferFormScreen() {
  const { id, from } = useLocalSearchParams<{ id: string; from?: string }>();
  const existing = useRecord("transfers", id === "new" ? null : id);
  const { toInput } = useMoney();

  const [initial] = useState<FormValues>(() => ({
    from: existing?.fromAccountId ?? from ?? null,
    to: existing?.toAccountId ?? null,
    amountFrom: existing ? toInput(existing.amountFrom) : "",
    // Same-currency transfers keep one amount; the second field only matters when currencies differ.
    amountTo: existing && existing.amountTo !== existing.amountFrom ? toInput(existing.amountTo) : "",
    date: existing?.date ?? todayLocal(),
    comment: existing?.comment ?? "",
  }));

  if (id !== "new" && !existing) return null;
  return <TransferForm initial={initial} existingId={existing?.id ?? null} />;
}

function TransferForm({ initial, existingId }: { initial: FormValues; existingId: string | null }) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const dialog = useDialog();
  const rates = useRates();
  const existing = useRecord("transfers", existingId);

  const [values, setValues] = useState(initial);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof FormValues>(key: K, value: FormValues[K]) =>
    setValues((current) => ({ ...current, [key]: value }));

  const fromAccount = useRecord("accounts", values.from);
  const toAccount = useRecord("accounts", values.to);
  const twoCurrencies = Boolean(fromAccount && toAccount && fromAccount.currency !== toAccount.currency);
  const rate = fromAccount && toAccount ? rateBetween(fromAccount.currency, toAccount.currency, rates) : null;

  const dirty = useMemo(() => (Object.keys(initial) as (keyof FormValues)[]).some((key) => values[key] !== initial[key]), [values, initial]);
  const leave = useUnsavedGuard(dirty && !saving);

  const { topMinor, bottomMinor } = twoCurrencies
    ? resolvePair(values.amountFrom, values.amountTo, rate)
    : { topMinor: parseAmount(values.amountFrom), bottomMinor: parseAmount(values.amountFrom) };

  const errors = {
    from: !values.from ? t("transfers.fromRequired") : null,
    to: !values.to ? t("transfers.toRequired") : values.to === values.from ? t("transfers.sameAccount") : null,
    amount: !topMinor || topMinor <= 0 ? t("amount.mustBePositive") : null,
    amountTo: twoCurrencies && (!bottomMinor || bottomMinor <= 0) ? t("amount.mustBePositive") : null,
  };
  const invalid = Object.values(errors).some(Boolean);
  const show = (error: string | null) => (submitted && error ? error : undefined);

  const save = async () => {
    setSubmitted(true);
    if (invalid || !values.from || !values.to || !topMinor || !bottomMinor) return;
    setSaving(true);
    await saveTransfer(
      {
        fromAccountId: values.from,
        toAccountId: values.to,
        amountFrom: topMinor,
        amountTo: bottomMinor,
        date: values.date,
        comment: values.comment.trim(),
      },
      existing
    );
    leave();
  };

  const remove = async () => {
    if (!existing) return;
    const ok = await dialog.confirm({
      title: t("transfers.deleteTitle"),
      message: t("transfers.deleteMessage"),
      confirmText: t("common.delete"),
      destructive: true,
    });
    if (!ok) return;
    setSaving(true);
    await deleteTransfer(existing.id);
    leave();
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader
        title={t(existing ? "transfers.edit" : "transfers.new")}
        left="back"
        right={
          existing ? (
            <Pressable onPress={remove} hitSlop={8} accessibilityRole="button" accessibilityLabel={t("common.delete")} style={{ padding: spacing.sm }}>
              <MaterialCommunityIcons name="trash-can-outline" size={26} color={colors.text} />
            </Pressable>
          ) : undefined
        }
      />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: spacing.md, gap: spacing.lg, paddingBottom: BOTTOM_ACTION_SPACE }}>
          <AccountPicker
            label={t("transfers.from")}
            value={values.from}
            onChange={(accountId) => set("from", accountId)}
            exclude={values.to}
            error={show(errors.from)}
          />
          <AccountPicker
            label={t("transfers.to")}
            value={values.to}
            onChange={(accountId) => set("to", accountId)}
            exclude={values.from}
            error={show(errors.to)}
          />

          <View style={{ gap: spacing.xs }}>
            <AppText variant="label">{t("transfers.amount")}</AppText>
            {twoCurrencies && fromAccount && toAccount ? (
              <AmountPair
                top={values.amountFrom}
                bottom={values.amountTo}
                onChangeTop={(text) => set("amountFrom", text)}
                onChangeBottom={(text) => set("amountTo", text)}
                topCurrency={fromAccount.currency}
                bottomCurrency={toAccount.currency}
                rate={rate}
                topError={show(errors.amount)}
                bottomError={show(errors.amountTo)}
              />
            ) : (
              <AmountInput
                value={values.amountFrom}
                onChangeText={(text) => set("amountFrom", text)}
                currency={fromAccount?.currency ?? toAccount?.currency ?? ""}
                error={show(errors.amount)}
                size="normal"
              />
            )}
          </View>

          <DateField label={t("transfers.date")} value={values.date} onChange={(date) => set("date", date)} />

          <TextField
            label={t("transfers.comment")}
            value={values.comment}
            onChangeText={(text) => set("comment", text)}
            placeholder={t("transfers.comment")}
            maxLength={500}
          />
        </ScrollView>
      </KeyboardAvoidingView>

      <BottomActionButton title={t(existing ? "common.save" : "common.add")} onPress={save} loading={saving} muted={invalid} />
    </View>
  );
}
