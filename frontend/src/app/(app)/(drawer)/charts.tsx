import { ComingSoon } from "@/components/ComingSoon";
import { useI18n } from "@/i18n/I18nProvider";

// Screen 6. Charts (data phase).
export default function ChartsScreen() {
  const { t } = useI18n();
  return <ComingSoon title={t("nav.charts")} icon="chart-bar" />;
}
