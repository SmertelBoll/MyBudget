import { useEffect } from "react";
import { useAuth } from "@/auth/AuthProvider";
import { useCollection } from "@/data/hooks";
import { useRates } from "@/data/rates";
import { useI18n } from "@/i18n/I18nProvider";
import { todayLocal } from "@/utils/dates";
import { registerBackgroundSync } from "./background";
import { refreshWidgets } from "./refresh";
import { buildSnapshot } from "./snapshot";

const SETTLE_MS = 800;

// While the app is open: any change to entries, accounts, categories, rates or settings redraws the widgets a moment
// later (a burst of changes, like a sync, makes one redraw). Also schedules the hourly background sync.
export function WidgetUpdater() {
  const { user } = useAuth();
  const { t, lang } = useI18n();
  const accounts = useCollection("accounts");
  const categories = useCollection("categories");
  const transactions = useCollection("transactions");
  const transfers = useCollection("transfers");
  const rates = useRates();

  useEffect(() => {
    registerBackgroundSync().catch((error) => console.warn("background sync not scheduled:", error));
  }, []);

  useEffect(() => {
    if (!user) return;
    const timer = setTimeout(() => {
      const snapshot = buildSnapshot({ user, lang, t, accounts, categories, transactions, transfers, rates, today: todayLocal() });
      refreshWidgets(snapshot).catch((error) => console.warn("widgets not updated:", error));
    }, SETTLE_MS);
    return () => clearTimeout(timer);
  }, [user, lang, t, accounts, categories, transactions, transfers, rates]);

  return null;
}
