import { Stack } from "expo-router";
import { useTheme } from "@/theme/ThemeProvider";

export default function AuthLayout() {
  const { colors } = useTheme();
  // Without its own background the navigator's default light grey showed under the login screen in the dark theme.
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }} />;
}
