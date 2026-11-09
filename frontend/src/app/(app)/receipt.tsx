import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Image, Pressable, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { router } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAuth } from "@/auth/AuthProvider";
import { categoryName } from "@/data/categories";
import { useCollection } from "@/data/hooks";
import { addPhoto } from "@/data/photos";
import { parseReceipt, parseReceiptRows, type ParsedReceipt } from "@/data/receiptParser";
import { reportWriteError } from "@/data/store";
import { useTagTree } from "@/data/tags";
import { saveTransaction } from "@/data/transactions";
import { useI18n } from "@/i18n/I18nProvider";
import { useTheme } from "@/theme/ThemeProvider";
import { radius, spacing } from "@/theme/tokens";
import { todayLocal } from "@/utils/dates";
import { KEYBOARD_GAP } from "@/utils/keyboard";
import { parseAmount } from "@/utils/money";
import { canRecognizeReceipts, recognizeReceipt } from "@/utils/receiptOcr";
import { useBottomSpace } from "@/utils/useBottomSpace";
import { useMoney } from "@/utils/useMoney";
import { usePickImage, type PickedImage } from "@/utils/usePickImage";
import { useUnsavedGuard } from "@/utils/useUnsavedGuard";
import { AccountPicker } from "@/components/AccountPicker";
import { AmountInput } from "@/components/AmountInput";
import { AppText } from "@/components/AppText";
import { BottomActionButton } from "@/components/BottomActionButton";
import { Button } from "@/components/Button";
import { DateField } from "@/components/DateField";
import { FullScreenModal } from "@/components/FullScreenModal";
import { IconCircle } from "@/components/IconCircle";
import { ScreenHeader } from "@/components/ScreenHeader";
import { TextField } from "@/components/TextField";
import { ToggleRow } from "@/components/ToggleRow";
import { useToast } from "@/components/Toast";
import { CategoryChooser } from "@/components/entry/CategoryChooser";
import { TagChips } from "@/components/entry/TagChips";

// One line of the receipt. Account, category and tags left unset follow the choice "for all items".
type Item = {
  key: string;
  name: string;
  amount: number;
  include: boolean;
  accountId?: string;
  categoryId?: string;
  tagIds?: string[];
};
type Common = { accountId: string | null; categoryId: string | null; tagIds: string[] };

let nextKey = 0;
const keyed = (name: string, amount: number): Item => ({ key: String(nextKey++), name, amount, include: true });

// For a browser preview (no ML Kit, no file dialog to drive): globalThis.__receiptSample = rows of text, read as a
// one-column receipt without a photo.
const sampleRows = () => (globalThis as { __receiptSample?: string[] }).__receiptSample;

// Spec: receipt photo -> items. A photo (camera or gallery) is read on the phone (ML Kit, modules/receipt-ocr); each
// line becomes an expense entry. The account, category and tags chosen "for all items" apply to every line not changed
// by hand; a tap on a line edits everything in it. The photo is attached to every entry.
export default function ReceiptScreen() {
  const { colors } = useTheme();
  const { t } = useI18n();
  const { user } = useAuth();
  const toast = useToast();
  const pickImage = usePickImage();
  const bottomSpace = useBottomSpace();
  const { money, toInput } = useMoney();
  const accounts = useCollection("accounts");
  const categories = useCollection("categories");
  const tagTree = useTagTree();

  const [photo, setPhoto] = useState<PickedImage | null>(null);
  const [stage, setStage] = useState<"pick" | "reading" | "review">("pick");
  const [notice, setNotice] = useState<string | null>(null);
  const [merchant, setMerchant] = useState("");
  // Comments stay empty unless switched on here; Settings decides how the switch starts.
  const [fillComments, setFillComments] = useState(user?.settings.receiptComments === true);
  const [date, setDate] = useState(todayLocal());
  const [receiptTotal, setReceiptTotal] = useState<number | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [common, setCommon] = useState<Common>(() => ({
    accountId: accounts.find((account) => account.id === user?.settings.defaultAccountId && account.isActive)?.id ?? null,
    categoryId: null,
    tagIds: [],
  }));
  const [editing, setEditing] = useState<Item | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const leave = useUnsavedGuard(stage === "review" && items.length > 0 && !saving);

  const fill = (parsed: ParsedReceipt) => {
    const lines = parsed.items.map((item) => keyed(item.name, item.amount));
    if (parsed.tax) lines.push(keyed(t("receipt.tax"), parsed.tax));
    setItems(lines);
    setMerchant(parsed.merchant ?? "");
    if (parsed.date && parsed.date <= todayLocal()) setDate(parsed.date);
    setReceiptTotal(parsed.total);
    if (!lines.length) setNotice(t("receipt.nothingFound"));
  };

  // Opens straight into the camera / gallery choice; backing out of it leaves the screen.
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      const sample = sampleRows();
      const picked = sample ? null : await pickImage(t("receipt.scan"));
      if (!picked && !sample) {
        router.back();
        return;
      }
      setPhoto(picked);
      if (!canRecognizeReceipts && !sample) {
        setNotice(t("receipt.notAvailable"));
        setStage("review");
        return;
      }
      setStage("reading");
      try {
        if (sample) {
          fill(parseReceiptRows(sample));
        } else {
          fill(parseReceipt(await recognizeReceipt(picked!.uri)));
        }
      } catch (error) {
        console.warn("receipt recognition failed:", error);
        setNotice(t("receipt.failed"));
      }
      setStage("review");
    })();
  });

  const resolved = (item: Item) => ({
    accountId: item.accountId ?? common.accountId,
    categoryId: item.categoryId ?? common.categoryId,
    tagIds: item.tagIds ?? common.tagIds,
  });
  const included = items.filter((item) => item.include);
  const itemsSum = included.reduce((sum, item) => sum + item.amount, 0);
  const allItemsSum = items.reduce((sum, item) => sum + item.amount, 0);
  const missingCategory = included.some((item) => !resolved(item).categoryId);
  const missingAccount = included.some((item) => !resolved(item).accountId);
  const categoryById = useMemo(() => new Map(categories.map((category) => [category.id, category])), [categories]);
  const accountById = useMemo(() => new Map(accounts.map((account) => [account.id, account])), [accounts]);
  const currency = accountById.get(common.accountId ?? "")?.currency ?? user?.baseCurrency ?? "USD";

  const save = async () => {
    setSubmitted(true);
    if (!included.length || missingCategory || missingAccount) return;
    setSaving(true);
    try {
      const photoId = photo && user?.settings.showPhotos !== false ? await addPhoto(photo) : null;
      const shop = merchant.trim();
      for (const item of included) {
        const { accountId, categoryId, tagIds } = resolved(item);
        const account = accountById.get(accountId!);
        if (!account || !categoryId) continue;
        await saveTransaction({
          type: "expense",
          accountId: account.id,
          categoryId,
          tagIds,
          amount: item.amount,
          currency: account.currency,
          accountAmount: item.amount,
          rate: 1,
          date,
          comment: !fillComments ? "" : shop ? `${item.name} · ${shop}` : item.name,
          photos: photoId ? [photoId] : [],
        });
      }
      toast.show(t("receipt.added", { count: included.length }));
      leave();
    } catch (error) {
      reportWriteError(error);
      setSaving(false);
    }
  };

  const updateItem = (next: Item) => setItems((current) => current.map((item) => (item.key === next.key ? next : item)));

  if (stage !== "review") {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <ScreenHeader title={t("receipt.title")} left="back" />
        {stage === "reading" && (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.md }}>
            <ActivityIndicator size="large" color={colors.mark} />
            <AppText secondary>{t("receipt.reading")}</AppText>
          </View>
        )}
      </View>
    );
  }

  const difference = receiptTotal !== null ? allItemsSum - receiptTotal : 0;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title={t("receipt.title")} left="back" />
      <KeyboardAwareScrollView
        bottomOffset={KEYBOARD_GAP}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: spacing.md, gap: spacing.lg, paddingBottom: bottomSpace }}
      >
        <View style={{ flexDirection: "row", gap: spacing.md, alignItems: "flex-start" }}>
          {photo && <Image source={{ uri: photo.uri }} style={{ width: 72, height: 96, borderRadius: radius.md }} resizeMode="cover" />}
          <View style={{ flex: 1, gap: spacing.sm }}>
            <TextField label={t("receipt.store")} value={merchant} onChangeText={setMerchant} maxLength={60} />
            <DateField label={t("entry.date")} value={date} onChange={setDate} />
          </View>
        </View>
        <ToggleRow label={t("receipt.fillComments")} value={fillComments} onChange={setFillComments} />

        {notice && (
          <View style={{ flexDirection: "row", gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.tonal }}>
            <MaterialCommunityIcons name="information-outline" size={20} color={colors.textSecondary} />
            <AppText secondary style={{ flex: 1 }}>
              {notice}
            </AppText>
          </View>
        )}

        <View style={{ gap: spacing.md, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surface }}>
          <AppText variant="heading">{t("receipt.forAll")}</AppText>
          <AccountPicker
            label={t("entry.account")}
            value={common.accountId}
            onChange={(accountId) => setCommon((current) => ({ ...current, accountId }))}
            error={submitted && missingAccount && !common.accountId ? t("entry.accountRequired") : undefined}
          />
          <CategoryChooser
            type="expense"
            value={common.categoryId}
            onChange={(categoryId) => setCommon((current) => ({ ...current, categoryId }))}
            error={submitted && missingCategory && !common.categoryId ? t("receipt.needCategory") : undefined}
          />
          <TagChips value={common.tagIds} categoryId={common.categoryId} onChange={(tagIds) => setCommon((current) => ({ ...current, tagIds }))} />
        </View>

        <View style={{ gap: spacing.sm }}>
          <AppText variant="heading">{t("receipt.items")}</AppText>
          {items.map((item) => {
            const { categoryId, accountId } = resolved(item);
            const category = categoryId ? categoryById.get(categoryId) : undefined;
            const own = [
              item.accountId ? accountById.get(item.accountId)?.name : null,
              ...(item.tagIds ?? []).map((id) => tagTree.byId.get(id)?.name),
            ].filter(Boolean);
            const problem = submitted && item.include && (!categoryId || !accountId);
            return (
              <View
                key={item.key}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  borderRadius: radius.md,
                  backgroundColor: colors.surface,
                  borderWidth: problem ? 1.5 : 0,
                  borderColor: colors.danger,
                  opacity: item.include ? 1 : 0.5,
                  overflow: "hidden",
                }}
              >
                <Pressable
                  onPress={() => updateItem({ ...item, include: !item.include })}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: item.include }}
                  accessibilityLabel={item.name}
                  hitSlop={6}
                  style={{ paddingLeft: spacing.md, paddingVertical: spacing.md }}
                >
                  <MaterialCommunityIcons
                    name={item.include ? "checkbox-marked-circle" : "checkbox-blank-circle-outline"}
                    size={24}
                    color={item.include ? colors.mark : colors.textSecondary}
                  />
                </Pressable>
                <Pressable
                  onPress={() => setEditing(item)}
                  accessibilityRole="button"
                  style={({ pressed }) => ({
                    flex: 1,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: spacing.sm,
                    padding: spacing.md,
                    backgroundColor: pressed ? colors.selected : "transparent",
                  })}
                >
                  <IconCircle icon={category?.icon ?? "help"} color={category?.color ?? colors.tonal} size={36} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <AppText numberOfLines={1}>{item.name}</AppText>
                    <AppText variant="caption" secondary numberOfLines={1}>
                      {[category ? categoryName(category, t) : t("receipt.needCategory"), ...own]
                        .filter(Boolean)
                        .join(" · ")}
                    </AppText>
                  </View>
                  <AppText variant="heading">{money(item.amount, accountById.get(accountId ?? "")?.currency ?? currency, true)}</AppText>
                </Pressable>
              </View>
            );
          })}
          <Button
            variant="secondary"
            title={t("receipt.addItem")}
            onPress={() => {
              const item = keyed("", 0);
              setItems((current) => [...current, item]);
              setEditing(item);
            }}
          />
        </View>

        <View style={{ gap: 2 }}>
          <AppText>{t("receipt.sum", { amount: money(itemsSum, currency, true) })}</AppText>
          {receiptTotal !== null && (
            <AppText secondary>{t("receipt.receiptTotal", { amount: money(receiptTotal, currency, true) })}</AppText>
          )}
          {receiptTotal !== null && difference !== 0 && (
            <AppText color={colors.danger}>{t("receipt.mismatch", { amount: money(Math.abs(difference), currency, true) })}</AppText>
          )}
        </View>
      </KeyboardAwareScrollView>

      <BottomActionButton
        title={t("receipt.save", { count: included.length })}
        onPress={save}
        loading={saving}
        muted={!included.length || missingCategory || missingAccount}
      />

      {editing && (
        <ItemEditor
          item={editing}
          common={common}
          toInput={toInput}
          onClose={() => {
            // A new line left empty isn't kept.
            setItems((current) => current.filter((item) => item.key !== editing.key || item.name || item.amount));
            setEditing(null);
          }}
          onSave={(next) => {
            updateItem(next);
            setEditing(null);
          }}
          onRemove={() => {
            setItems((current) => current.filter((item) => item.key !== editing.key));
            setEditing(null);
          }}
        />
      )}
    </View>
  );
}

// Everything of one line: name, sum, and its own account, category and tags (or the common ones).
function ItemEditor({
  item,
  common,
  toInput,
  onClose,
  onSave,
  onRemove,
}: {
  item: Item;
  common: Common;
  toInput: (minor: number) => string;
  onClose: () => void;
  onSave: (item: Item) => void;
  onRemove: () => void;
}) {
  const { t } = useI18n();
  const accounts = useCollection("accounts");
  const [name, setName] = useState(item.name);
  const [amount, setAmount] = useState(item.amount ? toInput(item.amount) : "");
  const [accountId, setAccountId] = useState(item.accountId ?? common.accountId);
  const [categoryId, setCategoryId] = useState(item.categoryId ?? common.categoryId);
  const [tagIds, setTagIds] = useState(item.tagIds ?? common.tagIds);
  const [submitted, setSubmitted] = useState(false);

  const minor = parseAmount(amount);
  const amountError = !minor || minor <= 0 ? t("amount.mustBePositive") : null;
  const nameError = !name.trim() ? t("common.required") : null;
  const currency = accounts.find((account) => account.id === accountId)?.currency ?? "USD";
  const same = (a: string[], b: string[]) => a.length === b.length && a.every((id) => b.includes(id));

  const save = () => {
    setSubmitted(true);
    if (amountError || nameError || !minor) return;
    // Only what differs from the common choice is kept on the line, so a later common change still reaches the rest.
    onSave({
      ...item,
      name: name.trim(),
      amount: minor,
      include: true,
      accountId: accountId && accountId !== common.accountId ? accountId : undefined,
      categoryId: categoryId && categoryId !== common.categoryId ? categoryId : undefined,
      tagIds: same(tagIds, common.tagIds) ? undefined : tagIds,
    });
  };

  return (
    <FullScreenModal visible title={item.name || t("receipt.item")} onClose={onClose}>
      <KeyboardAwareScrollView
        bottomOffset={KEYBOARD_GAP}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: spacing.md, gap: spacing.lg, paddingBottom: spacing.xl }}
      >
        <TextField
          label={t("receipt.itemName")}
          value={name}
          onChangeText={setName}
          maxLength={100}
          error={submitted && nameError ? nameError : undefined}
          autoFocus={!item.name}
        />
        <AmountInput
          value={amount}
          onChangeText={setAmount}
          currency={currency}
          size="normal"
          action="none"
          error={submitted && amountError ? amountError : undefined}
        />
        <AccountPicker label={t("entry.account")} value={accountId} onChange={setAccountId} />
        <CategoryChooser type="expense" value={categoryId} onChange={setCategoryId} />
        <TagChips value={tagIds} categoryId={categoryId} onChange={setTagIds} />
        <View style={{ flexDirection: "row", gap: spacing.sm }}>
          <Button variant="secondary" title={t("receipt.removeItem")} onPress={onRemove} style={{ flex: 1 }} />
          <Button title={t("common.save")} onPress={save} style={{ flex: 1 }} />
        </View>
      </KeyboardAwareScrollView>
    </FullScreenModal>
  );
}
