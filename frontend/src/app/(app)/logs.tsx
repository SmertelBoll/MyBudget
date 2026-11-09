import { useMemo, useState } from "react";
import { SectionList, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { EntryType } from "@/api/types";
import { useAuth } from "@/auth/AuthProvider";
import { categoryName } from "@/data/categories";
import { useCollection } from "@/data/hooks";
import { useRates } from "@/data/rates";
import { NO_TAG, filterTransactions, inBaseCurrency, type AccountFilter } from "@/data/stats";
import type { Transaction } from "@/data/types";
import { useI18n } from "@/i18n/I18nProvider";
import { useTheme } from "@/theme/ThemeProvider";
import { radius, spacing } from "@/theme/tokens";
import { addDays, formatLongDate, formatShortDate, todayLocal } from "@/utils/dates";
import { openNewTransaction, openTransaction } from "@/utils/navigation";
import { PERIOD_KINDS, currentPeriod, formatPeriod, type PeriodKind, type PeriodRange } from "@/utils/periods";
import { useBottomSpace } from "@/utils/useBottomSpace";
import { useMoney } from "@/utils/useMoney";
import { AccountFilterSelect } from "@/components/AccountFilterSelect";
import { AppText } from "@/components/AppText";
import { Fab } from "@/components/Fab";
import { HeaderSearchInput } from "@/components/HeaderSearchInput";
import { IconButton } from "@/components/IconButton";
import { exportTransactions } from "@/data/userData";
import { fileDate } from "@/utils/files";
import { useDeliverFile } from "@/utils/useDeliverFile";
import { LogRow } from "@/components/LogRow";
import { PeriodSwitcher } from "@/components/PeriodSwitcher";
import { ScreenHeader } from "@/components/ScreenHeader";
import { SegmentedSwitch } from "@/components/SegmentedSwitch";
import { SortMenu, type SortValue } from "@/components/SortMenu";

type Params = { type?: string; accounts?: string; kind?: string; start?: string; end?: string; category?: string; tag?: string };



const DATE = /^\d{4}-\d{2}-\d{2}$/;

// Home passes what it shows; opened any other way, the log starts from the user's settings.
const rangeFrom = (params: Params, fallback: PeriodRange): PeriodRange =>
  PERIOD_KINDS.includes(params.kind as PeriodKind) && DATE.test(params.start ?? "") && DATE.test(params.end ?? "")
    ? { kind: params.kind as PeriodKind, start: params.start!, end: params.end! }
    : fallback;

const normalize = (text: string) => text.toLowerCase().replace(/,/g, ".").replace(/\s/g, "");

// Screen 11. Entries of the chosen accounts and period, grouped by day (newest or oldest first) or sorted by amount.
// Search (comment, category, tag, account, amount) looks through every period. A tap opens the entry.
// Opened from a row on Home it shows only that category and / or tag for Home's period, with their name on top.
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
  const [sort, setSort] = useState<SortValue>({ key: "date", direction: "desc" });
  const onlyCategory = params.category || null;
  const onlyTag = params.tag || null;
  const narrowed = Boolean(onlyCategory || onlyTag);

  const accountById = useMemo(() => new Map(accounts.map((account) => [account.id, account])), [accounts]);
  const categoryById = useMemo(() => new Map(categories.map((category) => [category.id, category])), [categories]);
  const tagById = useMemo(() => new Map(tags.map((tag) => [tag.id, tag])), [tags]);

  const needle = normalize(query.trim());
  const rows = useMemo(() => {
    const allTime: PeriodRange = { kind: "custom", start: "0000-01-01", end: "9999-12-31" };
    const list = filterTransactions(transactions, { type, accountIds: filter, range: needle ? allTime : range }).filter((tx) => {
      if (onlyCategory && tx.categoryId !== onlyCategory) return false;
      if (!onlyTag) return true;
      const known = tx.tagIds.filter((id) => tagById.has(id));
      return onlyTag === NO_TAG ? known.length === 0 : known.includes(onlyTag);
    });
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
  }, [transactions, type, filter, range, needle, onlyCategory, onlyTag, accountById, categoryById, tagById, baseCurrency, rates, t, toInput]);

  const total = rows.reduce((sum, row) => sum + row.value, 0);
  const byAmount = sort.key === "amount";
  const sections = useMemo(() => {
    const direction = sort.direction === "asc" ? -1 : 1;
    const newestFirst = (a: (typeof rows)[number], b: (typeof rows)[number]) =>
      b.tx.date.localeCompare(a.tx.date) || b.tx.clientCreatedAt.localeCompare(a.tx.clientCreatedAt);
    // By amount: one list without day headers (each row shows its date instead).
    if (sort.key === "amount") {
      return [{ date: "", data: [...rows].sort((a, b) => direction * (b.value - a.value) || newestFirst(a, b)) }];
    }
    const sorted = [...rows].sort((a, b) => direction * newestFirst(a, b));
    const groups = new Map<string, typeof sorted>();
    for (const row of sorted) groups.set(row.tx.date, [...(groups.get(row.tx.date) ?? []), row]);
    return [...groups].map(([date, data]) => ({ date, data }));
  }, [rows, sort]);

  // What's on the screen right now (filters, period or search) goes to Excel.
  const deliver = useDeliverFile();
  const exportShown = () => {
    const sheet = t(type === "income" ? "entries.income" : "entries.expenses");
    const label = needle ? fileDate() : `${range.start}_${range.end}`;
    deliver(exportTransactions(rows.map((row) => row.tx), t, sheet, label)).catch((error) => console.warn("entries export failed:", error));
  };

  const onlyCategoryRecord = onlyCategory ? categoryById.get(onlyCategory) : undefined;
  const tagTitle = onlyTag ? (onlyTag === NO_TAG ? t("home.noTag") : (tagById.get(onlyTag)?.name ?? "?")) : null;
  const narrowTitle = [
    onlyCategoryRecord ? categoryName(onlyCategoryRecord, t) : onlyCategory ? "?" : null,
    tagTitle ? `#${tagTitle}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

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
        account={byAmount ? `${account?.name ?? "?"} · ${formatShortDate(tx.date, lang)}` : (account?.name ?? "?")}
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
          ) : narrowed ? (
            <View style={{ alignItems: "center" }}>
              <AppText variant="heading" numberOfLines={1} style={{ textTransform: "uppercase" }}>
                {narrowTitle}
              </AppText>
              <AppText variant="display">{money(total, baseCurrency)}</AppText>
            </View>
          ) : (
            <View style={{ alignItems: "center" }}>
              <AppText variant="title">{t("logs.title")}</AppText>
              <AccountFilterSelect value={filter} onChange={setFilter} />
            </View>
          )
        }
        right={
          <View style={{ flexDirection: "row" }}>
            {!searching && <IconButton icon="download" label={t("transfers.export")} onPress={exportShown} />}
            <IconButton
              icon={searching ? "close" : "magnify"}
              label={t(searching ? "common.close" : "logs.search")}
              onPress={() => {
                setSearching(!searching);
                setQuery("");
              }}
            />
          </View>
        }
      >
        {!narrowed && (
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
        )}
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
            {!needle && !narrowed && (
              <View style={{ backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.sm }}>
                <PeriodSwitcher value={range} onChange={setRange} />
              </View>
            )}
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
              {narrowed ? (
                <View style={{ flex: 1, alignItems: "flex-start", gap: 2 }}>
                  <AccountFilterSelect value={filter} onChange={setFilter} />
                  {!needle && (
                    <AppText variant="caption" secondary>
                      {formatPeriod(range, lang)}
                    </AppText>
                  )}
                </View>
              ) : (
                <AppText variant="heading" style={{ flex: 1 }}>
                  {t("logs.total", { amount: money(total, baseCurrency, true) })}
                </AppText>
              )}
              <SortMenu value={sort} onChange={setSort} />
            </View>
          </View>
        }
        ListEmptyComponent={
          <View style={{ alignItems: "center", gap: spacing.sm, paddingVertical: spacing.xl }}>
            <MaterialCommunityIcons name={needle ? "text-search" : "receipt-text-outline"} size={48} color={colors.textSecondary} />
            <AppText secondary>{t(needle ? "logs.noResults" : "logs.empty")}</AppText>
          </View>
        }
        renderSectionHeader={({ section }) =>
          !section.date ? null : (
          <AppText variant="label" secondary style={{ marginTop: spacing.sm, textTransform: "capitalize" }}>
            {dayTitle(section.date)}
          </AppText>
          )
        }
        renderItem={({ item }) => renderRow(item)}
      />
      <Fab label={t("entry.addTitle")} onPress={() => openNewTransaction(type)} />
    </View>
  );
}
