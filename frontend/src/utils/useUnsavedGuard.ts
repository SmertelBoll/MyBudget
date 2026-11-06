import { useCallback, useState } from "react";
import { router, usePreventRemove } from "expo-router";
import { useDialog } from "@/components/AppDialog";
import { useI18n } from "@/i18n/I18nProvider";

// Spec 2.7: leaving a form with unsaved changes asks "Leave without saving?" (back arrow, system back, swipe).
// Returns `leave`, which closes the screen without asking (after saving).
export const useUnsavedGuard = (dirty: boolean) => {
  const dialog = useDialog();
  const { t } = useI18n();
  const [leaving, setLeaving] = useState(false);

  const disable = usePreventRemove(dirty && !leaving, ({ repeat }) => {
    dialog
      .confirm({
        title: t("common.unsavedTitle"),
        message: t("common.unsavedMessage"),
        confirmText: t("common.leave"),
        destructive: true,
      })
      .then((ok) => {
        if (!ok) return;
        setLeaving(true);
        repeat();
      });
  });

  return useCallback(() => {
    setLeaving(true);
    disable();
    if (router.canGoBack()) router.back();
  }, [disable]);
};
