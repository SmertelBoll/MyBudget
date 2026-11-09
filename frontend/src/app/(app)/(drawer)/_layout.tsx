import { Drawer } from "expo-router/drawer";
import { useTheme } from "@/theme/ThemeProvider";
import { DrawerContent } from "@/components/DrawerContent";

// Top-level screens with the side menu (spec screen 3). Each screen draws its own header (ScreenHeader).
export default function DrawerLayout() {
  const { colors } = useTheme();
  return (
    <Drawer
      drawerContent={(props) => <DrawerContent {...props} />}
      screenOptions={{
        headerShown: false,
        drawerStyle: { backgroundColor: colors.surface },
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Drawer.Screen name="index" />
      <Drawer.Screen name="accounts" />
      {/* Swiping the bars towards older periods starts at the left edge too: there it scrolls, never opens the menu. */}
      <Drawer.Screen name="charts" options={{ swipeEnabled: false }} />
      <Drawer.Screen name="categories" />
      <Drawer.Screen name="recurring" />
      <Drawer.Screen name="reminders" />
      <Drawer.Screen name="settings" />
      <Drawer.Screen name="support" />
      {/* Not in the menu list (DrawerContent draws its own items); opened from the avatar. No `hidden`: that
          option also redirects away from the screen. */}
      <Drawer.Screen name="profile" />
    </Drawer>
  );
}
