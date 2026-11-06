import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { DrawerContentScrollView, type DrawerContentComponentProps } from "expo-router/drawer";
import { useAuth } from "@/auth/AuthProvider";
import { useI18n } from "@/i18n/I18nProvider";
import { useTheme } from "@/theme/ThemeProvider";
import { radius, spacing } from "@/theme/tokens";
import { AppText } from "./AppText";
import { Avatar } from "./Avatar";
import { SyncIndicator } from "./SyncIndicator";

type Icon = keyof typeof MaterialCommunityIcons.glyphMap;

// Order and names from spec screen 3.
const ITEMS: { route: string; label: string; icon: Icon }[] = [
  { route: "index", label: "nav.home", icon: "chart-donut" },
  { route: "accounts", label: "nav.accounts", icon: "wallet-outline" },
  { route: "charts", label: "nav.charts", icon: "chart-bar" },
  { route: "categories", label: "nav.categories", icon: "shape-outline" },
  { route: "recurring", label: "nav.recurring", icon: "calendar-sync-outline" },
  { route: "reminders", label: "nav.reminders", icon: "bell-outline" },
  { route: "settings", label: "nav.settings", icon: "cog-outline" },
  { route: "support", label: "nav.support", icon: "email-outline" },
];

export function DrawerContent({ state, navigation }: DrawerContentComponentProps) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const current = state.routes[state.index]?.name;

  const go = (route: string) => {
    navigation.navigate(route);
    navigation.closeDrawer();
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <Pressable
        onPress={() => go("profile")}
        accessibilityRole="button"
        accessibilityLabel={t("nav.profile")}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.md,
          paddingTop: insets.top + spacing.lg,
          paddingBottom: spacing.lg,
          paddingHorizontal: spacing.md,
          borderBottomWidth: 1,
          borderBottomColor: colors.selected,
        }}
      >
        <Avatar icon={user?.avatar.icon} color={user?.avatar.color} size={56} />
        <View style={{ flex: 1 }}>
          <AppText variant="heading" numberOfLines={1}>
            {user?.name}
          </AppText>
          {/* TODO(data phase): "Balance: <Total>" under the name (spec screen 3). */}
          <AppText variant="caption" secondary numberOfLines={1}>
            {user?.email}
          </AppText>
        </View>
      </Pressable>

      <DrawerContentScrollView contentContainerStyle={{ paddingTop: spacing.sm }}>
        {ITEMS.map((item) => {
          const active = item.route === current;
          return (
            <Pressable
              key={item.route}
              onPress={() => go(item.route)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.md,
                paddingVertical: spacing.md,
                paddingHorizontal: spacing.md,
                marginHorizontal: spacing.sm,
                borderRadius: radius.md,
                backgroundColor: active ? colors.accent : pressed ? colors.selected : "transparent",
              })}
            >
              <MaterialCommunityIcons name={item.icon} size={24} color={active ? colors.onAccent : colors.text} />
              <AppText color={active ? colors.onAccent : colors.text}>{t(item.label)}</AppText>
            </Pressable>
          );
        })}
      </DrawerContentScrollView>

      <View style={{ paddingBottom: insets.bottom, borderTopWidth: 1, borderTopColor: colors.selected }}>
        <SyncIndicator />
      </View>
    </View>
  );
}
