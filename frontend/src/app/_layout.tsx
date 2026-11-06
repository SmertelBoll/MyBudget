import { useEffect, type ReactNode } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { useFonts } from "expo-font";
import { Rubik_400Regular, Rubik_500Medium, Rubik_600SemiBold } from "@expo-google-fonts/rubik";
import { Bungee_400Regular } from "@expo-google-fonts/bungee";
import { AuthProvider, useAuth } from "@/auth/AuthProvider";
import { I18nProvider, deviceLanguage } from "@/i18n/I18nProvider";
import { ThemeProvider, useTheme } from "@/theme/ThemeProvider";
import { DialogProvider } from "@/components/AppDialog";
import { ToastProvider } from "@/components/Toast";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({ Rubik_400Regular, Rubik_500Medium, Rubik_600SemiBold, Bungee_400Regular });

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      {/* Lets forms scroll the focused field above the keyboard. The app draws edge-to-edge (behind the status and
          navigation bars); said explicitly, because in Expo Go the provider can't detect it and would paint the bars solid. */}
      <KeyboardProvider statusBarTranslucent navigationBarTranslucent preserveEdgeToEdge>
      <AuthProvider>
        <UserScopedProviders ready={fontsLoaded || Boolean(fontError)}>
          <RootNavigator />
        </UserScopedProviders>
      </AuthProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}

// Theme and language follow the signed-in user's settings; before sign-in, the phone's.
function UserScopedProviders({ ready, children }: { ready: boolean; children: ReactNode }) {
  const { status, user } = useAuth();
  const loading = !ready || status === "loading";

  useEffect(() => {
    if (!loading) SplashScreen.hideAsync();
  }, [loading]);

  if (loading) return null;
  return (
    <ThemeProvider mode={user?.theme ?? "system"}>
      <I18nProvider lang={user?.language ?? deviceLanguage()}>
        <DialogProvider>
          <ToastProvider>{children}</ToastProvider>
        </DialogProvider>
      </I18nProvider>
    </ThemeProvider>
  );
}

function RootNavigator() {
  const { status, user } = useAuth();
  const { colors, scheme } = useTheme();
  const signedIn = status === "signedIn";
  const onboarded = Boolean(user?.onboarded && user.baseCurrency);
  // Where a closed group sends the user. Without it the router falls back to the group itself ("/(auth)"), which
  // has no index route.
  const home = !signedIn ? "/login" : onboarded ? "/" : "/onboarding";

  return (
    <>
      <StatusBar style={scheme === "dark" ? "light" : "dark"} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
        <Stack.Protected guard={!signedIn} redirectTo={home}>
          <Stack.Screen name="(auth)" />
        </Stack.Protected>
        <Stack.Protected guard={signedIn && !onboarded} redirectTo={home}>
          <Stack.Screen name="onboarding" />
        </Stack.Protected>
        <Stack.Protected guard={signedIn && onboarded} redirectTo={home}>
          <Stack.Screen name="(app)" />
        </Stack.Protected>
      </Stack>
    </>
  );
}
