import { useMemo, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAuth } from "@/auth/AuthProvider";
import { deactivateAccount, deleteAccountWithData, moveBalance, saveAccount, sortAccounts } from "@/data/accounts";
import { useBalances } from "@/data/balances";
import { useCollection, useRecord } from "@/data/hooks";
import { ACCOUNT_ICON_SECTIONS, DEFAULT_ACCOUNT_ICON, DEFAULT_COLOR } from "@/constants/appearance";
import { useI18n } from "@/i18n/I18nProvider";
import { useTheme } from "@/theme/ThemeProvider";
import { radius, spacing } from "@/theme/tokens";
import { useBottomSpace } from "@/utils/useBottomSpace";
import { useCurrencyOptions, usePinnedCurrencies } from "@/utils/currency";
import { todayLocal } from "@/utils/dates";
import { parseSignedAmount } from "@/utils/money";
import { useMoney } from "@/utils/useMoney";
import { useUnsavedGuard } from "@/utils/useUnsavedGuard";
import { useDialog } from "@/components/AppDialog";
import { AmountInput } from "@/components/AmountInput";
import { AppText } from "@/components/AppText";
import { BottomActionButton } from "@/components/BottomActionButton";
import { ColorPicker } from "@/components/ColorPicker";
import { IconCircle } from "@/components/IconCircle";
import { IconPicker } from "@/components/IconPicker";
import { ScreenHeader } from "@/components/ScreenHeader";
import { SelectField } from "@/components/SelectField";
import { TextField } from "@/components/TextField";
import { ToggleRow } from "@/components/ToggleRow";
import { useToast } from "@/components/Toast";

const DELETE_COUNTDOWN_S = 10;

// Screen 5.2: create ("new") and edit share one form; editing fills it from the account.
export default function AccountFormScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const existing = useRecord("accounts", id === "new" ? null : id);
  const balances = useBalances();
  const { user } = useAuth();
  const { toInput } = useMoney();

  // The form starts from these values (taken once); "dirty" compares against them.
  const [initial] = useState<FormValues>(() => ({
    balance: existing ? toInput(balances.get(existing.id) ?? 0) : "",
    currency: existing?.currency ?? user?.baseCurrency ?? "USD",
    name: existing?.name ?? "",
    icon: existing?.icon ?? DEFAULT_ACCOUNT_ICON,
    color: existing?.color ?? DEFAULT_COLOR,
    includeInTotal: existing?.includeInTotal ?? true,
    note: existing?.note ?? "",
  }));

  if (id !== "new" && !existing) return null;
  return <AccountForm initial={initial} existingId={existing?.id ?? null} />;
}

type FormValues = {
  balance: string;
  currency: string;
  name: string;
  icon: string;
  color: string;
  includeInTotal: boolean;
  note: string;
};

function AccountForm({ initial, existingId }: { initial: FormValues; existingId: string | null }) {
  const { colors } = useTheme();
  const bottomSpace = useBottomSpace();
  const { t } = useI18n();
  const dialog = useDialog();
  const toast = useToast();
  const { updateMe, user } = useAuth();
  const { money } = useMoney();
  const currencyOptions = useCurrencyOptions();
  const pinnedCurrencies = usePinnedCurrencies();
  const existing = useRecord("accounts", existingId);
  const accounts = useCollection("accounts");
  const balances = useBalances();

  const [values, setValues] = useState(initial);
  const [submitted, setSubmitted] = useState(false);
  const [touchedName, setTouchedName] = useState(false);
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof FormValues>(key: K, value: FormValues[K]) =>
    setValues((current) => ({ ...current, [key]: value }));

  const dirty = useMemo(() => (Object.keys(initial) as (keyof FormValues)[]).some((key) => values[key] !== initial[key]), [values, initial]);
  const leave = useUnsavedGuard(dirty && !saving);

  // Empty balance means 0 (spec 5.2).
  const balance = values.balance.trim() ? parseSignedAmount(values.balance) : 0;
  const nameError = !values.name.trim() ? t("accounts.nameRequired") : null;
  const balanceError = balance === null ? t("amount.invalid") : null;
  const showNameError = (touchedName || submitted) && nameError;

  const save = async () => {
    setSubmitted(true);
    if (nameError || balance === null) return;
    setSaving(true);
    await saveAccount(
      {
        name: values.name.trim(),
        currency: values.currency,
        icon: values.icon,
        color: values.color,
        includeInTotal: values.includeInTotal,
        note: values.note.trim(),
      },
      balance,
      existing
    );
    leave();
  };

  // Spec 5.3: confirm -> (money left?) move it -> with or without its transactions -> 10 s countdown.
  // Nothing changes until the countdown has finished.
  const remove = async () => {
    if (!existing) return;
    const sure = await dialog.confirm({
      title: t("accounts.deleteTitle"),
      message: t("accounts.deleteMessage", { name: existing.name }),
      confirmText: t("common.delete"),
      destructive: true,
    });
    if (!sure) return;

    let moveTo: string | null = null;
    const left = balances.get(existing.id) ?? 0;
    const others = sortAccounts(accounts.filter((account) => account.isActive && account.id !== existing.id));
    if (left > 0 && others.length) {
      const choice = await dialog.choose({
        title: t("accounts.moveMoneyTitle"),
        message: t("accounts.moveMoneyMessage", { amount: money(left, existing.currency, true) }),
        options: [
          ...others.map((account) => ({ value: account.id, label: account.name })),
          { value: "keep", label: t("accounts.dontMove") },
        ],
      });
      if (choice === null) return;
      moveTo = choice === "keep" ? null : choice;
    }

    const mode = await dialog.choose({
      title: t("accounts.deleteModeTitle"),
      message: t("accounts.deleteModeMessage"),
      options: [
        { value: "hide", label: t("accounts.deleteHide") },
        { value: "all", label: t("accounts.deleteAll"), destructive: true },
      ],
    });
    if (mode === null) return;

    const final = await dialog.confirm({
      title: t("accounts.deleteFinalTitle"),
      message: t(mode === "all" ? "accounts.deleteFinalAll" : "accounts.deleteFinalHide"),
      cancelText: t("accounts.keep"),
      destructive: true,
      countdown: { seconds: DELETE_COUNTDOWN_S, autoConfirm: true },
    });
    if (!final) return;

    setSaving(true);
    const target = others.find((account) => account.id === moveTo);
    if (target) await moveBalance(existing, target, todayLocal());
    if (mode === "all") await deleteAccountWithData(existing);
    else await deactivateAccount(existing);

    // Settings pointing at this account fall back to the defaults.
    const settings = user?.settings;
    if (settings && (settings.homeAccount === existing.id || settings.defaultAccountId === existing.id)) {
      updateMe({
        settings: {
          ...(settings.homeAccount === existing.id && { homeAccount: "total" }),
          ...(settings.defaultAccountId === existing.id && { defaultAccountId: null }),
        },
      }).catch(() => {});
    }
    toast.show(t("accounts.deleted"));
    leave();
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader
        title={existing ? existing.name : t("accounts.new")}
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
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: spacing.md, gap: spacing.lg, paddingBottom: bottomSpace }}
        >
          <View style={{ backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, gap: spacing.md }}>
            <AmountInput
              value={values.balance}
              onChangeText={(text) => set("balance", text)}
              currency={values.currency}
              error={balanceError ?? undefined}
              allowNegative
            />
            {existing ? (
              <AppText variant="caption" secondary>
                {t("accounts.currencyFixed")}
              </AppText>
            ) : (
              <SelectField
                label={t("accounts.currency")}
                value={values.currency}
                options={currencyOptions}
            pinned={pinnedCurrencies}
                onChange={(currency) => set("currency", currency)}
              />
            )}
          </View>

          <View style={{ flexDirection: "row", alignItems: "flex-end", gap: spacing.md }}>
            <View style={{ paddingBottom: showNameError ? 22 : 2 }}>
              <IconCircle icon={values.icon} color={values.color} size={48} />
            </View>
            <View style={{ flex: 1 }}>
              <TextField
                label={t("accounts.name")}
                value={values.name}
                onChangeText={(text) => set("name", text)}
                onBlur={() => setTouchedName(true)}
                error={showNameError ? nameError : undefined}
                maxLength={50}
              />
            </View>
          </View>

          <IconPicker
            label={t("accounts.icon")}
            sections={ACCOUNT_ICON_SECTIONS}
            value={values.icon}
            color={values.color}
            onChange={(icon) => set("icon", icon)}
          />

          <ColorPicker label={t("accounts.color")} value={values.color} onChange={(color) => set("color", color)} />

          <ToggleRow label={t("accounts.includeInTotal")} value={values.includeInTotal} onChange={(value) => set("includeInTotal", value)} />

          <TextField
            label={t("accounts.note")}
            value={values.note}
            onChangeText={(text) => set("note", text)}
            placeholder={t("accounts.notePlaceholder")}
            maxLength={200}
          />
        </ScrollView>
      </KeyboardAvoidingView>

      <BottomActionButton title={t("common.save")} onPress={save} loading={saving} muted={Boolean(nameError || balanceError)} />
    </View>
  );
}
