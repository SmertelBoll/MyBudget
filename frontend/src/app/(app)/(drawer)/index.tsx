import { View } from "react-native";
import { useI18n } from "@/i18n/I18nProvider";
import { openNewTransaction } from "@/utils/navigation";
import { ComingSoon } from "@/components/ComingSoon";
import { Fab } from "@/components/Fab";

// Screen 2. Home: chart, categories and tags for the period come in stage 5; the "+" already opens screen 4.
export default function HomeScreen() {
  const { t } = useI18n();
  return (
    <View style={{ flex: 1 }}>
      <ComingSoon title={t("nav.home")} icon="chart-donut" />
      <Fab label={t("entry.addTitle")} onPress={() => openNewTransaction()} />
    </View>
  );
}
