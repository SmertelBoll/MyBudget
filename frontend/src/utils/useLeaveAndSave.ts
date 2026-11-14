import { useCallback } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import { useToast } from "@/components/Toast";

// Closes a form at once and saves after: a save redraws every screen showing that data (lists, Home, charts), and
// done first it held the way back for a moment. The screen goes now; the work starts a moment later, once the
// (native) transition is under way. A timer, not the next frame: frames stop while the app is in the background,
// and a save must not wait for the user to come back. If the work fails, a message says so; the screen is already
// gone, so there is nothing to keep open.
// `leave` is the form's own (useUnsavedGuard), which skips the "leave without saving?" question.
const AFTER_LEAVING_MS = 50;

export const useLeaveAndSave = (leave: () => void) => {
  const toast = useToast();
  const { t } = useI18n();
  return useCallback(
    (work: () => unknown, after?: () => unknown) => {
      leave();
      setTimeout(() => {
        Promise.resolve()
          .then(work)
          .then(after)
          .catch((error) => {
            console.error("save failed:", error);
            toast.show(t("common.saveFailed"), { kind: "error" });
          });
      }, AFTER_LEAVING_MS);
    },
    [leave, toast, t]
  );
};
