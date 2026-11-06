import { useMemo, useState } from "react";
import { SectionList, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { EntryType } from "@/api/types";
import { useAuth } from "@/auth/AuthProvider";
import { categoryName } from "@/data/categories";
import { useCollection } from "@/data/hooks";
import { useRates } from "@/data/rates";
import { filterTransactions, inBaseCurrency, type AccountFilter } from "@/data/stats";
import type { Transaction } from "@/data/types";
import { useI18n } from "@/i18n/I18nProvider";
import { useTheme } from "@/theme/ThemeProvider";
import { radius, spacing } from "@/theme/tokens";
import { addDays, formatLongDate, todayLocal } from "@/utils/dates";
import { openNewTransaction, openTransaction } from "@/utils/navigation";
import { PERIOD_KINDS, currentPeriod, type PeriodKind, type PeriodRange } from "@/utils/periods";
import { useBottomSpace } from "@/utils/useBottomSpace";
import { useMoney } from "@/utils/useMoney";
import { AccountFilterSelect } from "@/components/AccountFilterSelect";
import { AppText } from "@/components/AppText";
import { Fab } from "@/components/Fab";
import { HeaderSearchInput } from "@/components/HeaderSearchInput";
import { IconButton } from "@/components/IconButton";
import { LogRow } from "@/components/LogRow";
import { PeriodSwitcher } from "@/components/PeriodSwitcher";
import { ScreenHeader } from "@/components/ScreenHeader";
import { SegmentedSwitch } from "@/components/SegmentedSwitch";

type Params = { type?: string; accounts?: string; kind?: string; start?: string; end?: string };

const DATE = /^\d{4}-\d{2}-\d{2}$/;

// Home passes what it shows; opened any other way, the log starts from the user's settings.
const rangeFrom = (params: Params, fallback: PeriodRange): PeriodRange =>
  PERIOD_KINDS.includes(params.kind as PeriodKind) && DATE.test(params.start ?? "") && DATE.test(params.end ?? "")
    ? { kind: params.kind as PeriodKind, start: params.start!, end: params.end! }
    : fallback;

const normalize = (text: string) => text.toLowerCase().replace(/,/g, ".").replace(/\s/g, "");

// Screen 11. Entries of the chosen accounts and period, newest first, grouped by day. Search (comment, category,
// tag, account, amount) looks through every period. A tap opens the entry.
export default function LogsScreen() {
  const { colors } = useTheme();
  const { t, lang } = useI18n();
  const { money, toInput, baseCurrency } = useMoney();
  const { user } = useAuth();
  const bottomSpace = useBottomSpace();
  const params = useLocalSearchParams<Params>();
  const transactions = useCollection("transactions");
  const accounts = useCollection("accounts");
  const categories = useCollection("categories");
  const tags = useCollection("tags");
  const rates = useRates();

  const [type, setType] = useState<EntryType>(
    params.type === "income" || params.type === "expense" ? params.type : (user?.settings.focus ?? "expense")
  );
  const [filter, setFilter] = useState<AccountFilter>(() => (params.accounts ? params.accounts.split(",") : null));
  const [range, setRange] = useState<PeriodRange>(() =>
    rangeFrom(params, currentPeriod(user?.settings.defaultPeriod ?? "week", user?.settings.firstDayOfWeek ?? 1))
  );
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState("");

  const accountById = useMemo(() => new Map(accounts.map((account) => [account.id, account])), [accounts]);
  const categoryById = useMemo(() => new Map(categories.map((category) => [category.id, category])), [categories]);
  const tagById = useMemo(() => new Map(tags.map((tag) => [tag.id, tag])), [tags]);

  const needle = normalize(query.trim());
  const rows = useMemo(() => {
    const allTime: PeriodRange = { kind: "custom", start: "0000-01-01", end: "9999-12-31" };
    const list = filterTransactions(transactions, { type, accountIds: filter, range: needle ? allTime : range });
    const withValue = list.map((tx) => ({ tx, value: inBaseCurrency(tx, accountById, baseCurrency, rates) }));
    if (!needle) return withValue;
    return withValue.filter(({ tx, value }) => {
      const category = categoryById.get(tx.categoryId);
      const texts = [
        tx.comment,
        category ? categoryName(category, t) : "",
        accountById.get(tx.accountId)?.name ?? "",
        ...tx.tagIds.map((id) => tagById.get(id)?.name ?? ""),
        toInput(tx.amount),
        toInput(tx.accountAmount),
        toInput(value),
      ];
      return texts.some((text) => normalize(text).includes(needle));
    });
  }, [transactions, type, filter, range, needle, accountById, categoryById, tagById, baseCurrency, rates, t, toInput]);

  const total = rows.reduce((sum, row) => sum + row.value, 0);
  const sections = useMemo(() => {
    const sorted = [...rows].sort((a, b) => b.tx.date.localeCompare(a.tx.date) || b.tx.clientCreatedAt.localeCompare(a.tx.clientCreatedAt));
    const groups = new Map<string, typeof sorted>();
    for (const row of sorted) groups.set(row.tx.date, [...(groups.get(row.tx.date) ?? []), row]);
    return [...groups].map(([date, data]) => ({ date, data }));
  }, [rows]);

  const today = todayLocal();
  const dayTitle = (date: string) => {
    const relative = date === today ? t("dates.today") : date === addDays(today, -1) ? t("dates.yesterday") : null;
    return relative ? `${relative}, ${formatLongDate(date, lang)}` : formatLongDate(date, lang);
  };

  const renderRow = ({ tx, value }: { tx: Transaction; value: number }) => {
    const category = categoryById.get(tx.categoryId);
    const account = accountById.get(tx.accountId);
    return (
      <LogRow
        icon={category?.icon ?? "help"}
        color={category?.color ?? colors.iconIdle}
        title={category ? categoryName(category, t) : "?"}
        account={account?.name ?? "?"}
        amount={money(value, baseCurrency, true)}
        original={tx.currency !== baseCurrency ? money(tx.amount, tx.currency, true) : undefined}
        tags={tx.tagIds.map((id) => tagById.get(id)?.name).filter((name): name is string => Boolean(name))}
        comment={user?.settings.showComment === false ? undefined : tx.comment}
        hasPhotos={tx.photos.length > 0}
        onPress={() => openTransaction(tx.id)}
      />
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader
        left="back"
        center={
          searching ? (
            <HeaderSearchInput value={query} onChangeText={setQuery} placeholder={t("logs.search")} />
          ) : (
            <View style={{ alignItems: "center" }}>
              <AppText variant="title">{t("logs.title")}</AppText>
              <AccountFilterSelect value={filter} onChange={setFilter} />
            </View>
          )
        }
        right={
          <IconButton
            icon={searching ? "close" : "magnify"}
            label={t(searching ? "common.close" : "logs.search")}
            onPress={() => {
              setSearching(!searching);
              setQuery("");
            }}
          />
        }
      >
        <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.xs }}>
          <SegmentedSwitch
            options={[
              { value: "expense", label: t("entries.expenses") },
              { value: "income", label: t("entries.income") },
            ]}
            value={type}
            onChange={setType}
          />
        </View>
      </ScreenHeader>

      <SectionList
        sections={sections}
        keyExtractor={(row) => row.tx.id}
        stickySectionHeadersEnabled={false}
        initialNumToRender={15}
        maxToRenderPerBatch={20}
        windowSize={7}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: spacing.md, gap: spacing.sm, paddingBottom: bottomSpace }}
        ListHeaderComponent={
          <View style={{ gap: spacing.sm }}>
            {!needle && (
              <View style={{ backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.sm }}>
                <PeriodSwitcher value={range} onChange={setRange} />
              </View>
            )}
            <AppText variant="heading">{t("logs.total", { amount: money(total, baseCurrency, true) })}</AppText>
          </View>
        }
        ListEmptyComponent={
          <View style={{ alignItems: "center", gap: spacing.sm, paddingVertical: spacing.xl }}>
            <MaterialCommunityIcons name={needle ? "text-search" : "receipt-text-outline"} size={48} color={colors.textSecondary} />
            <AppText secondary>{t(needle ? "logs.noResults" : "logs.empty")}</AppText>
          </View>
        }
        renderSectionHeader={({ section }) => (
          <AppText variant="label" secondary style={{ marginTop: spacing.sm, textTransform: "capitalize" }}>
            {dayTitle(section.date)}
          </AppText>
        )}
        renderItem={({ item }) => renderRow(item)}
      />
      <Fab label={t("entry.addTitle")} onPress={() => openNewTransaction(type)} />
    </View>
  );
}
