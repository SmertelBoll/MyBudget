import { ComingSoon } from "@/components/ComingSoon";
import { useI18n } from "@/i18n/I18nProvider";

// Screen 5. Accounts (data phase).
export default function AccountsScreen() {
  const { t } = useI18n();
  return <ComingSoon title={t("nav.accounts")} icon="wallet-outline" />;
}
