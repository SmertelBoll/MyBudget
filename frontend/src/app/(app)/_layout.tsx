import { Drawer } from "expo-router/drawer";
import { useTheme } from "@/theme/ThemeProvider";
import { DrawerContent } from "@/components/DrawerContent";

// Signed-in part of the app: the side menu (spec screen 3) around every top-level screen. Each screen draws its own
// header (ScreenHeader), so the navigator's header is off.
export default function AppLayout() {
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
      <Drawer.Screen name="charts" />
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
