import type { ReactNode } from "react";
import { ScrollView, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { categoryName } from "@/data/categories";
import { useCollection, useRecord } from "@/data/hooks";
import { deleteRecurring, isActivePayment, setRecurringActive, setRecurringNotify } from "@/data/recurring";
import { reportWriteError } from "@/data/store";
import { useI18n } from "@/i18n/I18nProvider";
import { requestNotificationPermission } from "@/notifications/notifications";
import { useTheme } from "@/theme/ThemeProvider";
import { radius, spacing } from "@/theme/tokens";
import { formatLongDate } from "@/utils/dates";
import { describeRule } from "@/utils/repeat";
import { nextOccurrence } from "@/utils/schedule";
import { useBottomSpace } from "@/utils/useBottomSpace";
import { useMoney } from "@/utils/useMoney";
import { useDialog } from "@/components/AppDialog";
import { AppText } from "@/components/AppText";
import { Button } from "@/components/Button";
import { IconCircle } from "@/components/IconCircle";
import { ScreenHeader } from "@/components/ScreenHeader";
import { useToast } from "@/components/Toast";
import { ToggleRow } from "@/components/ToggleRow";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={{ gap: 4 }}>
      <AppText variant="caption" secondary>
        {label}
      </AppText>
      {typeof children === "string" ? <AppText variant="heading">{children}</AppText> : children}
    </View>
  );
}

// Screen 8.2: everything about one payment; Edit and Delete at the bottom (no pencil on top).
export default function RecurringDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const payment = useRecord("recurring", id);
  const { colors } = useTheme();
  const { t, lang } = useI18n();
  const { money } = useMoney();
  const dialog = useDialog();
  const toast = useToast();
  const bottomSpace = useBottomSpace();
  const account = useRecord("accounts", payment?.accountId);
  const category = useRecord("categories", payment?.categoryId);
  const tags = useCollection("tags");

  if (!payment) return null;
  const next = nextOccurrence(payment);
  const tagNames = payment.tagIds.map((tagId) => tags.find((tag) => tag.id === tagId)?.name).filter((name): name is string => Boolean(name));

  const remove = async () => {
    const ok = await dialog.confirm({
      title: t("recurring.deleteTitle"),
      message: t("recurring.deleteMessage"),
      confirmText: t("common.delete"),
      destructive: true,
    });
    if (!ok) return;
    deleteRecurring(payment.id).catch(reportWriteError);
    router.back();
  };

  const toggleNotify = async (on: boolean) => {
    setRecurringNotify(payment, on).catch(reportWriteError);
    if (on && !(await requestNotificationPermission())) toast.show(t("recurring.notificationsOff"), { kind: "error" });
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title={t("recurring.details")} left="back" />
      <ScrollView contentContainerStyle={{ padding: spacing.md, gap: spacing.lg, paddingBottom: bottomSpace }}>
        <View style={{ padding: spacing.md, gap: spacing.lg, borderRadius: radius.md, backgroundColor: colors.surface }}>
          <Field label={t("recurring.name")}>{payment.name}</Field>
          <Field label={t("recurring.type")}>{t(payment.type === "expense" ? "entries.expense" : "entries.incomeOne")}</Field>
          <ToggleRow label={t("recurring.active")} value={isActivePayment(payment)} onChange={(on) => setRecurringActive(payment, on).catch(reportWriteError)} />
          <ToggleRow label={t("recurring.notify")} value={payment.notify} onChange={toggleNotify} />
          <Field label={t("recurring.repeat")}>{describeRule(payment.rule, t, lang)}</Field>
          <Field label={t("recurring.autoAdd")}>{t(payment.autoAdd ? "common.yes" : "common.no")}</Field>
          <Field label={t("recurring.next")}>{!isActivePayment(payment) ? t("recurring.paused") : next ? `${formatLongDate(next.date, lang)}, ${next.time}` : t("recurring.finished")}</Field>
          {payment.endDate ? <Field label={t("recurring.endDate")}>{formatLongDate(payment.endDate, lang)}</Field> : null}
          <Field label={t("entry.account")}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
              {account && <IconCircle icon={account.icon} color={account.color} size={36} />}
              <AppText variant="heading">{account?.name ?? "?"}</AppText>
            </View>
          </Field>
          <Field label={t("entry.category")}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
              {category && <IconCircle icon={category.icon} color={category.color} size={36} />}
              <AppText variant="heading">{category ? categoryName(category, t) : "?"}</AppText>
            </View>
          </Field>
          <Field label={t("transfers.amount")}>{money(payment.amount, payment.currency, true)}</Field>
          {tagNames.length > 0 && (
            <Field label={t("tags.title")}>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.xs }}>
                {tagNames.map((name) => (
                  <View key={name} style={{ paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.md, backgroundColor: colors.tonal }}>
                    <AppText variant="label">{name}</AppText>
                  </View>
                ))}
              </View>
            </Field>
          )}
          {payment.comment ? <Field label={t("transfers.comment")}>{payment.comment}</Field> : null}
        </View>

        <View style={{ flexDirection: "row", gap: spacing.sm }}>
          <Button title={t("common.delete")} variant="danger" onPress={remove} style={{ flex: 1 }} />
          <Button
            title={t("common.edit")}
            onPress={() => router.push({ pathname: "/recurring/edit/[id]", params: { id: payment.id } })}
            style={{ flex: 1 }}
          />
        </View>
      </ScrollView>
    </View>
  );
}
