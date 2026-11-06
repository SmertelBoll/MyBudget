import { ComingSoon } from "@/components/ComingSoon";
import { useI18n } from "@/i18n/I18nProvider";

// Screen 2. Home: chart, categories and tags for the period (data phase).
export default function HomeScreen() {
  const { t } = useI18n();
  return <ComingSoon title={t("nav.home")} icon="chart-donut" />;
}
