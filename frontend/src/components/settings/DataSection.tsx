import { useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { ApiError } from "@/api/client";
import { useAuth } from "@/auth/AuthProvider";
import { BackupFileError, createBackup, deleteAllData, exportToExcel, readBackup, recalculateBalances, restoreBackup } from "@/data/userData";
import { useI18n } from "@/i18n/I18nProvider";
import { useTheme } from "@/theme/ThemeProvider";
import { spacing } from "@/theme/tokens";
import { formatLongDate, toLocalDate } from "@/utils/dates";
import { pickFile } from "@/utils/files";
import { AppText } from "../AppText";
import { useDialog } from "../AppDialog";
import { useToast } from "../Toast";
import { SettingsCard, SettingsLink } from "./SettingsCard";

const DELETE_COUNTDOWN_S = 10;

type Job = "backup" | "restore" | "recalculate" | "excel" | "delete";

// Settings -> Data and storage (spec 13.4). Backup and Excel work offline (made from the device's data); restoring
// and deleting change the server's copy, so they need the internet.
export function DataSection() {
  const { colors } = useTheme();
  const { t, lang } = useI18n();
  const dialog = useDialog();
  const toast = useToast();
  const { user, acceptUser } = useAuth();
  const [job, setJob] = useState<Job | null>(null);

  if (!user) return null;

  const run = async (name: Job, work: () => Promise<void>) => {
    setJob(name);
    try {
      await work();
    } catch (error) {
      const code = error instanceof ApiError ? error.code : error instanceof BackupFileError ? error.message : "common.serverError";
      console.warn(`${name} failed:`, error, error instanceof ApiError ? JSON.stringify(error.details ?? null) : "");
      // Which record the server refused, so a damaged backup can be traced.
      const details = error instanceof ApiError && Array.isArray(error.details) ? (error.details[0] as { path?: string } | undefined) : undefined;
      toast.show(details?.path ? `${t(code)} (${details.path})` : t(code), { kind: "error" });
    } finally {
      setJob(null);
    }
  };

  const backup = () =>
    run("backup", async () => {
      const { missing } = await createBackup(user);
      toast.show(missing ? t("data.backupMissingPhotos", { count: missing }) : t("data.backupDone"));
    });

  const restore = () =>
    run("restore", async () => {
      const file = await pickFile(["*/*"]);
      if (!file) return;
      const backupFile = readBackup(file.bytes);
      const created = backupFile.createdAt ? formatLongDate(toLocalDate(new Date(backupFile.createdAt)), lang) : "—";
      const ok = await dialog.confirm({
        title: t("data.restoreTitle"),
        message: t("data.restoreMessage", { date: created, count: backupFile.transactions, photos: backupFile.photos.length }),
        confirmText: t("data.restore"),
        destructive: true,
      });
      if (!ok) return;
      acceptUser(await restoreBackup(backupFile));
      toast.show(t("data.restored"));
    });

  const recalculate = () =>
    run("recalculate", async () => {
      await recalculateBalances();
      toast.show(t("data.recalculated"));
    });

  const excel = () => run("excel", () => exportToExcel(t));

  // Same two steps as deleting an account: a warning, then a countdown that can still be stopped.
  const removeAll = async () => {
    const sure = await dialog.confirm({
      title: t("data.deleteTitle"),
      message: t("data.deleteMessage"),
      confirmText: t("data.delete"),
      destructive: true,
    });
    if (!sure) return;
    const final = await dialog.confirm({
      title: t("data.deleteFinalTitle"),
      message: t("data.deleteFinalMessage"),
      cancelText: t("profile.keep"),
      destructive: true,
      countdown: { seconds: DELETE_COUNTDOWN_S, autoConfirm: true },
    });
    if (!final) return;
    await run("delete", async () => {
      acceptUser(await deleteAllData());
      toast.show(t("data.deleted"));
    });
  };

  const busy = job !== null;
  const link = (name: Job, props: Omit<Parameters<typeof SettingsLink>[0], "disabled">) => (
    <View>
      <SettingsLink {...props} disabled={busy} />
      {job === name && <ActivityIndicator color={colors.accent} style={{ position: "absolute", right: spacing.xl, top: 14 }} />}
    </View>
  );

  return (
    <SettingsCard title={t("settings.data")}>
      {link("backup", { icon: "archive-arrow-down-outline", label: t("data.backup"), hint: t("data.backupHint"), onPress: backup })}
      {link("restore", { icon: "archive-arrow-up-outline", label: t("data.restore"), hint: t("data.restoreHint"), onPress: restore })}
      {link("recalculate", { icon: "calculator-variant-outline", label: t("data.recalculate"), hint: t("data.recalculateHint"), onPress: recalculate })}
      {link("excel", { icon: "microsoft-excel", label: t("data.excel"), hint: t("data.excelHint"), onPress: excel })}
      {link("delete", { icon: "delete-forever-outline", label: t("data.delete"), hint: t("data.deleteHint"), onPress: removeAll, danger: true })}
      <AppText variant="caption" secondary>
        {t("data.onlineNote")}
      </AppText>
    </SettingsCard>
  );
}
