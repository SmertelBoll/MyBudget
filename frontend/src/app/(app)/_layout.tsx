import { Stack } from "expo-router";
import { useAuth } from "@/auth/AuthProvider";
import { DataProvider } from "@/data/DataProvider";
import "@/data/debug";
import { useTheme } from "@/theme/ThemeProvider";

// Signed-in part of the app: the local data layer around everything. The drawer screens sit at the bottom of this
// stack; forms (account, transfer...) open on top of them with a back arrow.
export default function AppLayout() {
  const { colors } = useTheme();
  const { user } = useAuth();
  if (!user) return null;

  return (
    <DataProvider user={user}>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
        <Stack.Screen name="(drawer)" />
      </Stack>
    </DataProvider>
  );
}
