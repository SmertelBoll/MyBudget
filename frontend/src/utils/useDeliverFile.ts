import { useCallback } from "react";
import { useDialog } from "@/components/AppDialog";
import { useToast } from "@/components/Toast";
import type { OutputFile } from "@/data/userData";
import { useI18n } from "@/i18n/I18nProvider";
import { canSaveToDevice, saveFileToDevice, shareFile } from "./files";

// Where a made file goes. Android and the browser: "Save on this device" or "Share…"; iOS: the share sheet (it has
// "Save to Files"). Resolves true only when the file was saved, so "saved" is never shown for a closed picker.
export const useDeliverFile = () => {
  const { t } = useI18n();
  const dialog = useDialog();
  const toast = useToast();
  return useCallback(
    async (file: OutputFile) => {
      if (!canSaveToDevice) {
        await shareFile(file.name, file.bytes, file.mimeType);
        return false;
      }
      const how = await dialog.choose({
        title: file.name,
        options: [
          { value: "save", label: t("data.saveToDevice") },
          { value: "share", label: t("data.share") },
        ],
      });
      if (how === "share") {
        await shareFile(file.name, file.bytes, file.mimeType);
        return false;
      }
      if (how !== "save") return false;
      const folder = await saveFileToDevice(file.name, file.bytes, file.mimeType);
      if (folder === null) return false;
      toast.show(t("data.savedTo", { folder }));
      return true;
    },
    [dialog, t, toast]
  );
};
