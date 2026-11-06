import { useMemo, useRef, useState, type ComponentRef } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import type { EntryType } from "@/api/types";
import { useAuth } from "@/auth/AuthProvider";
import { categoryName } from "@/data/categories";
import { useCollection, useRecord } from "@/data/hooks";
import { rateBetween, useRates } from "@/data/rates";
import { reportWriteError } from "@/data/store";
import { createOneTimePayment, deleteTransaction, saveTransaction } from "@/data/transactions";
import { useI18n } from "@/i18n/I18nProvider";
import { useTheme } from "@/theme/ThemeProvider";
import { radius, spacing } from "@/theme/tokens";
import { useCurrencyOptions, usePinnedCurrencies } from "@/utils/currency";
import { todayLocal } from "@/utils/dates";
import { parseAmount } from "@/utils/money";
import { useBottomSpace } from "@/utils/useBottomSpace";
import { useMoney } from "@/utils/useMoney";
import { useAfterFirstFrame } from "@/utils/useAfterFirstFrame";
import { useUnsavedGuard } from "@/utils/useUnsavedGuard";
import { AccountPicker } from "@/components/AccountPicker";
import { useDialog } from "@/components/AppDialog";
import { AmountInput } from "@/components/AmountInput";
import { AmountPair, resolvePair } from "@/components/AmountPair";
import { BottomActionButton } from "@/components/BottomActionButton";
import { IconButton } from "@/components/IconButton";
import { ScreenHeader } from "@/components/ScreenHeader";
import { SegmentedSwitch } from "@/components/SegmentedSwitch";
import { SelectModal } from "@/components/SelectField";
import { TextField } from "@/components/TextField";
import { useToast } from "@/components/Toast";
import { CategoryChooser } from "@/components/entry/CategoryChooser";
import { DateChips } from "@/components/entry/DateChips";
import { PhotoStrip } from "@/components/entry/PhotoStrip";
import { TagChips } from "@/components/entry/TagChips";

type FormValues = {
  type: EntryType;
  amount: string;
  accountAmount: string;
  // The entry's currency; follows the account until the user picks one (spec 4.2).
  currency: string;
  currencyPicked: boolean;
  accountId: string | null;
  categoryId: string | null;
  date: string;
  tagIds: string[];
  comment: string;
  photos: string[];
};

const sameValues = (a: FormValues, b: FormValues) => JSON.stringify(a) === JSON.stringify(b);

// Screen 4: add ("new", ?type=expense|income) and edit share one form.
export default function TransactionFormScreen() {
  const { id, type } = useLocalSearchParams<{ id: string; type?: EntryType }>();
  const existing = useRecord("transactions", id === "new" ? null : id);
  const { user } = useAuth();
  const { toInput } = useMoney();
  const accounts = useCollection("accounts");

  const [initial] = useState<FormValues>(() => {
    if (existing) {
      const account = accounts.find((item) => item.id === existing.accountId);
      const twoCurrencies = account && account.currency !== existing.currency;
      return {
        type: existing.type,
        amount: toInput(existing.amount),
        accountAmount: twoCurrencies ? toInput(existing.accountAmount) : "",
        currency: existing.currency,
        currencyPicked: true,
        accountId: existing.accountId,
        categoryId: existing.categoryId,
        date: existing.date,
        tagIds: existing.tagIds,
        comment: existing.comment,
        photos: existing.photos,
      };
    }
    // Settings -> Personalisation: the default account, if it still exists (spec 13.1).
    const defaultAccount = accounts.find((item) => item.id === user?.settings.defaultAccountId && item.isActive);
    return {
      type: type === "income" || type === "expense" ? type : (user?.settings.focus ?? "expense"),
      amount: "",
      accountAmount: "",
      currency: defaultAccount?.currency ?? user?.baseCurrency ?? "USD",
      currencyPicked: false,
      accountId: defaultAccount?.id ?? null,
      categoryId: null,
      date: todayLocal(),
      tagIds: [],
      comment: "",
      photos: [],
    };
  });

  if (id !== "new" && !existing) return null;
  return <TransactionForm initial={initial} existingId={existing?.id ?? null} />;
}

function TransactionForm({ initial, existingId }: { initial: FormValues; existingId: string | null }) {
  const { colors } = useTheme();
  const bottomSpace = useBottomSpace();
  const { t } = useI18n();
  const dialog = useDialog();
  const toast = useToast();
  const { user } = useAuth();
  const rates = useRates();
  const currencyOptions = useCurrencyOptions();
  const pinnedCurrencies = usePinnedCurrencies();
  const existing = useRecord("transactions", existingId);
  const categories = useCollection("categories");
  const accounts = useCollection("accounts");

  const [values, setValues] = useState(initial);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [currencyOpen, setCurrencyOpen] = useState(false);
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const positions = useRef<Record<string, number>>({});

  const set = <K extends keyof FormValues>(key: K, value: FormValues[K]) =>
    setValues((current) => ({ ...current, [key]: value }));

  const account = useRecord("accounts", values.accountId);
  const twoCurrencies = Boolean(account && values.currency !== account.currency);
  const rate = account ? rateBetween(values.currency, account.currency, rates) : 1;

  const dirty = useMemo(() => !sameValues(values, initial), [values, initial]);
  const leave = useUnsavedGuard(dirty && !saving);
  // Fields below the fold are drawn a frame later, so the screen opens without waiting for them.
  const belowFold = useAfterFirstFrame();

  const { topMinor, bottomMinor } = twoCurrencies
    ? resolvePair(values.amount, values.accountAmount, rate)
    : { topMinor: parseAmount(values.amount), bottomMinor: parseAmount(values.amount) };

  const errors = {
    amount: !topMinor || topMinor <= 0 ? t("amount.mustBePositive") : null,
    accountAmount: twoCurrencies && (!bottomMinor || bottomMinor <= 0) ? t("amount.mustBePositive") : null,
    account: !values.accountId ? t("entry.accountRequired") : null,
    category: !values.categoryId ? t("entry.categoryRequired") : null,
  };
  const invalid = Object.values(errors).some(Boolean);
  const show = (error: string | null) => (submitted && error ? error : undefined);

  const chooseAccount = (accountId: string) =>
    setValues((current) => {
      const next = { ...current, accountId };
      const chosen = accounts.find((item) => item.id === accountId);
      // Spec 4.2: the currency follows the account until it's picked by hand.
      if (chosen && !current.currencyPicked) next.currency = chosen.currency;
      return next;
    });

  const changeType = (type: EntryType) =>
    setValues((current) => {
      const category = categories.find((item) => item.id === current.categoryId);
      // Expense and income categories are different (spec 4.1): a category of the other type is cleared.
      return { ...current, type, categoryId: category?.type === type ? current.categoryId : null };
    });

  // Spec 2.7: after a failed save, scroll to the first field with an error.
  const scrollToFirstError = () => {
    const order: (keyof typeof errors)[] = ["amount", "accountAmount", "account", "category"];
    const first = order.find((key) => errors[key]);
    const y = first ? positions.current[first === "accountAmount" ? "amount" : first] : undefined;
    if (y !== undefined) scrollRef.current?.scrollTo({ y: Math.max(0, y - spacing.md), animated: true });
  };

  const save = async () => {
    setSubmitted(true);
    if (invalid || !account || !values.categoryId || !topMinor || !bottomMinor) {
      scrollToFirstError();
      return;
    }

    const fields = {
      type: values.type,
      accountId: account.id,
      categoryId: values.categoryId,
      tagIds: values.tagIds,
      amount: topMinor,
      currency: values.currency,
      accountAmount: bottomMinor,
      rate: bottomMinor / topMinor,
      date: values.date,
      comment: user?.settings.showComment === false ? (existing?.comment ?? "") : values.comment.trim(),
      photos: user?.settings.showPhotos === false ? (existing?.photos ?? []) : values.photos,
    };

    // Spec 4.5: a future date asks how to book it (every time; the choice isn't remembered). Two short questions:
    // now or on that date, and only for "on that date" whether to remind. Closing either one keeps the form open.
    if (!existing && values.date > todayLocal()) {
      const when = await dialog.choose({
        title: t("entry.futureTitle"),
        message: t("entry.futureMessage"),
        options: [
          { value: "now", label: t("entry.futureNow") },
          { value: "later", label: t("entry.futureLater") },
        ],
      });
      if (!when) return;
      if (when === "later") {
        const remind = await dialog.choose({
          title: t("entry.futureNotifyTitle"),
          message: t("entry.futureNotifyMessage"),
          options: [
            { value: "yes", label: t("entry.futureNotifyYes") },
            { value: "no", label: t("entry.futureNotifyNo") },
          ],
        });
        if (!remind) return;
        if (fields.photos.length) {
          const ok = await dialog.confirm({
            title: t("entry.photosNotMovedTitle"),
            message: t("entry.photosNotMovedMessage"),
            confirmText: t("common.continue"),
          });
          if (!ok) return;
        }
        const category = categories.find((item) => item.id === values.categoryId);
        setSaving(true);
        createOneTimePayment({
          ...fields,
          name: category ? categoryName(category, t) : t("entry.payment"),
          notify: remind === "yes",
          accountCurrency: account.currency,
        }).catch(reportWriteError);
        toast.show(t("entry.paymentCreated"));
        leave();
        return;
      }
    }

    setSaving(true);
    saveTransaction(fields, existing).catch(reportWriteError);
    toast.show(t(existing ? "entry.saved" : "entry.added"));
    leave();
  };

  const remove = async () => {
    if (!existing) return;
    const ok = await dialog.confirm({
      title: t("entry.deleteTitle"),
      message: t("entry.deleteMessage"),
      confirmText: t("common.delete"),
      destructive: true,
    });
    if (!ok) return;
    setSaving(true);
    deleteTransaction(existing.id).catch(reportWriteError);
    leave();
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader
        title={t(existing ? "entry.editTitle" : "entry.addTitle")}
        left="back"
        right={existing ? <IconButton icon="trash-can-outline" label={t("common.delete")} onPress={remove} /> : undefined}
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

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          ref={scrollRef}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: spacing.md, gap: spacing.lg, paddingBottom: bottomSpace }}
        >
          <View onLayout={(event) => {
            positions.current.amount = event.nativeEvent.layout.y;
          }} style={{ backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md }}>
            {twoCurrencies && account ? (
              <AmountPair
                top={values.amount}
                bottom={values.accountAmount}
                onChangeTop={(text) => set("amount", text)}
                onChangeBottom={(text) => set("accountAmount", text)}
                topCurrency={values.currency}
                bottomCurrency={account.currency}
                rate={rate}
                topError={show(errors.amount)}
                bottomError={show(errors.accountAmount)}
                autoFocus={!existing}
                onTopCurrencyPress={() => setCurrencyOpen(true)}
              />
            ) : (
              <AmountInput
                value={values.amount}
                onChangeText={(text) => set("amount", text)}
                currency={values.currency}
                onCurrencyPress={() => setCurrencyOpen(true)}
                error={show(errors.amount)}
                autoFocus={!existing}
              />
            )}
          </View>

          <View onLayout={(event) => {
            positions.current.account = event.nativeEvent.layout.y;
          }}>
            <AccountPicker label={t("entry.account")} value={values.accountId} onChange={chooseAccount} error={show(errors.account)} />
          </View>

          <View onLayout={(event) => {
            positions.current.category = event.nativeEvent.layout.y;
          }}>
            <CategoryChooser
              type={values.type}
              value={values.categoryId}
              onChange={(categoryId) => set("categoryId", categoryId)}
              error={show(errors.category)}
            />
          </View>

          <DateChips value={values.date} onChange={(date) => set("date", date)} />

          {belowFold && (
            <>
          {/* Tags sit near the end of the form: scrolling to the end brings the search field up before the keyboard. */}
          <TagChips
            categoryId={values.categoryId}
            value={values.tagIds}
            onChange={(tagIds) => set("tagIds", tagIds)}
            onSearchOpen={() => scrollRef.current?.scrollToEnd({ animated: true })}
          />

          {/* Settings can hide these; data already saved in them is kept (spec 4.6). */}
          {user?.settings.showComment !== false && (
            <TextField
              label={t("transfers.comment")}
              value={values.comment}
              onChangeText={(text) => set("comment", text)}
              placeholder={t("transfers.comment")}
              maxLength={500}
              multiline
            />
          )}
          {user?.settings.showPhotos !== false && <PhotoStrip value={values.photos} onChange={(photos) => set("photos", photos)} />}
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      <BottomActionButton title={t(existing ? "common.save" : "common.add")} onPress={save} loading={saving} muted={invalid} />

      {currencyOpen && (
        <SelectModal
          title={t("accounts.currency")}
          value={values.currency}
          options={currencyOptions}
          pinned={[...new Set([...(account ? [account.currency] : []), ...pinnedCurrencies])].slice(0, 5)}
          onChange={(currency) => setValues((current) => ({ ...current, currency, currencyPicked: true, accountAmount: "" }))}
          onClose={() => setCurrencyOpen(false)}
        />
      )}
    </View>
  );
}

