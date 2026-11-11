import { useMemo, useState } from "react";
import { FlatList, Pressable, View } from "react-native";
import { router } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useCollection } from "@/data/hooks";
import { convert, useRates } from "@/data/rates";
import { isActivePayment, pendingPayments, setRecurringActive, settlePending, type PendingPayment } from "@/data/recurring";
import { reportWriteError } from "@/data/store";
import type { Recurring } from "@/data/types";
import { useI18n } from "@/i18n/I18nProvider";
import { requestNotificationPermission } from "@/notifications/notifications";
import { useTheme } from "@/theme/ThemeProvider";
import { radius, spacing } from "@/theme/tokens";
import { formatLongDate } from "@/utils/dates";
import { atMinute, nextOccurrence, type Occurrence } from "@/utils/schedule";
import { useBottomSpace } from "@/utils/useBottomSpace";
import { useClock } from "@/utils/useClock";
import { useMoney } from "@/utils/useMoney";
import { AppText } from "@/components/AppText";
import { Button } from "@/components/Button";
import { Fab } from "@/components/Fab";
import { HeaderSearchInput } from "@/components/HeaderSearchInput";
import { IconButton } from "@/components/IconButton";
import { ScreenHeader } from "@/components/ScreenHeader";
import { SortMenu, type SortValue } from "@/components/SortMenu";
import { useToast } from "@/components/Toast";
import { ToggleRow } from "@/components/ToggleRow";

const signed = (payment: Recurring, text: string) => `${payment.type === "expense" ? "−" : "+"}${text}`;

// The switch turns the payment on and off: a paused one adds, asks and notifies nothing.
function PaymentRow({ payment, next, onToggleActive }: { payment: Recurring; next: Occurrence | null; onToggleActive: (on: boolean) => void }) {
  const { colors } = useTheme();
  const { t, lang } = useI18n();
  const { money } = useMoney();
  const once = payment.rule.kind === "once";
  const active = isActivePayment(payment);
  return (
    <Pressable
      onPress={() => router.push({ pathname: "/recurring/[id]", params: { id: payment.id } })}
      accessibilityRole="button"
      style={({ pressed }) => ({
        padding: spacing.md,
        gap: 4,
        borderRadius: radius.md,
        backgroundColor: pressed ? colors.selected : colors.surface,
        opacity: active ? 1 : 0.55,
      })}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
        <AppText variant="heading" numberOfLines={1} style={{ flex: 1 }}>
          {payment.name}
        </AppText>
        <ToggleRow label={t("recurring.active")} value={active} onChange={onToggleActive} hideLabel />
      </View>
      <AppText variant="title" color={payment.type === "income" ? colors.text : colors.textSecondary}>
        {signed(payment, money(payment.amount, payment.currency, "entry"))}
      </AppText>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
        <MaterialCommunityIcons name="calendar-clock" size={16} color={colors.textSecondary} />
        <AppText variant="caption" secondary style={{ flex: 1, textTransform: "capitalize" }} numberOfLines={1}>
          {!active ? t("recurring.paused") : next ? `${formatLongDate(next.date, lang)}, ${next.time}` : t("recurring.finished")}
        </AppText>
        <MaterialCommunityIcons
          name={once ? "repeat-once" : "repeat"}
          size={18}
          color={colors.textSecondary}
          accessibilityLabel={t(once ? "recurring.oneTime" : "recurring.regular")}
        />
      </View>
    </Pressable>
  );
}

function PendingRow({ item, onSettle }: { item: PendingPayment; onSettle: (confirm: boolean) => void }) {
  const { colors } = useTheme();
  const { t, lang } = useI18n();
  const { money } = useMoney();
  const { payment, occurrence } = item;
  return (
    <View style={{ padding: spacing.md, gap: spacing.sm, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.mark }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
        <AppText variant="heading" numberOfLines={1} style={{ flex: 1 }}>
          {payment.name}
        </AppText>
        <AppText variant="heading">{signed(payment, money(payment.amount, payment.currency, "entry"))}</AppText>
      </View>
      <AppText variant="caption" secondary style={{ textTransform: "capitalize" }}>
        {formatLongDate(occurrence.date, lang)}, {occurrence.time}
      </AppText>
      <View style={{ flexDirection: "row", gap: spacing.sm }}>
        <Button title={t("recurring.skip")} variant="secondary" onPress={() => onSettle(false)} style={{ flex: 1 }} />
        <Button title={t("recurring.confirm")} onPress={() => onSettle(true)} style={{ flex: 1 }} />
      </View>
    </View>
  );
}

// Screen 8.1: the regular payments with their next date, a notification switch each, payments waiting for
// confirmation on top, search, sorting (date / amount / name) and the link to the coming month.
export default function RecurringScreen() {
  const { colors } = useTheme();
  const { t } = useI18n();
  const toast = useToast();
  const bottomSpace = useBottomSpace();
  const { baseCurrency } = useMoney();
  const rates = useRates();
  const payments = useCollection("recurring");
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortValue>({ key: "date", direction: "asc" });

  // Recomputed as time passes: a payment whose time has come shows up without leaving the screen.
  const now = useClock();
  const pending = useMemo(() => pendingPayments(payments, now), [payments, now]);
  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const list = payments
      .filter((payment) => !needle || payment.name.toLowerCase().includes(needle) || payment.comment.toLowerCase().includes(needle))
      .map((payment) => ({ payment, next: nextOccurrence(payment, atMinute(now)) }));
    const direction = sort.direction === "asc" ? 1 : -1;
    const inBase = (payment: Recurring) => convert(payment.amount, payment.currency, baseCurrency, rates) ?? payment.amount;
    return list.sort((a, b) => {
      if (sort.key === "name") return direction * a.payment.name.localeCompare(b.payment.name);
      if (sort.key === "amount") return direction * (inBase(a.payment) - inBase(b.payment));
      // Finished payments stay at the end either way.
      if (!a.next || !b.next) return a.next ? -1 : b.next ? 1 : 0;
      return direction * `${a.next.date} ${a.next.time}`.localeCompare(`${b.next.date} ${b.next.time}`);
    });
  }, [payments, query, sort, baseCurrency, rates, now]);

  const toggleActive = async (payment: Recurring, on: boolean) => {
    setRecurringActive(payment, on).catch(reportWriteError);
    if (on && payment.notify && !(await requestNotificationPermission())) toast.show(t("recurring.notificationsOff"), { kind: "error" });
  };

  const settle = (item: PendingPayment, confirm: boolean) => {
    settlePending(item, confirm)
      .then(() => confirm && toast.show(t("recurring.confirmed")))
      .catch(reportWriteError);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader
        title={t("recurring.title")}
        center={searching ? <HeaderSearchInput value={query} onChangeText={setQuery} placeholder={t("recurring.search")} /> : undefined}
        right={
          <IconButton
            icon={searching ? "close" : "magnify"}
            label={t(searching ? "common.close" : "recurring.search")}
            onPress={() => {
              setSearching(!searching);
              setQuery("");
            }}
          />
        }
      />
      <FlatList
        data={rows}
        keyExtractor={(row) => row.payment.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: spacing.md, gap: spacing.sm, paddingBottom: bottomSpace }}
        ListHeaderComponent={
          <View style={{ gap: spacing.sm }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
              <Pressable
                onPress={() => router.push("/upcoming")}
                accessibilityRole="button"
                style={({ pressed }) => ({ flex: 1, flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: spacing.sm, opacity: pressed ? 0.6 : 1 })}
              >
                <MaterialCommunityIcons name="calendar-clock" size={24} color={colors.text} />
                <AppText variant="heading">{t("recurring.upcoming")}</AppText>
                <MaterialCommunityIcons name="chevron-right" size={22} color={colors.textSecondary} />
              </Pressable>
              <SortMenu value={sort} onChange={setSort} keys={["date", "amount", "name"]} />
            </View>
            {pending.length > 0 && (
              <View style={{ gap: spacing.sm, marginBottom: spacing.sm }}>
                <AppText variant="label">{t("recurring.pending")}</AppText>
                {pending.map((item) => (
                  <PendingRow key={`${item.payment.id}-${item.occurrence.date}-${item.occurrence.time}`} item={item} onSettle={(confirm) => settle(item, confirm)} />
                ))}
              </View>
            )}
          </View>
        }
        ListEmptyComponent={
          <View style={{ alignItems: "center", gap: spacing.sm, paddingVertical: spacing.xl }}>
            <MaterialCommunityIcons name="calendar-sync" size={48} color={colors.textSecondary} />
            <AppText secondary>{t(query ? "logs.noResults" : "recurring.empty")}</AppText>
          </View>
        }
        renderItem={({ item }) => <PaymentRow payment={item.payment} next={item.next} onToggleActive={(on) => toggleActive(item.payment, on)} />}
      />
      <Fab label={t("recurring.add")} onPress={() => router.push({ pathname: "/recurring/edit/[id]", params: { id: "new" } })} />
    </View>
  );
}
