import { AtkinsonHyperlegibleNext_400Regular } from "@expo-google-fonts/atkinson-hyperlegible-next/400Regular";
import { AtkinsonHyperlegibleNext_700Bold } from "@expo-google-fonts/atkinson-hyperlegible-next/700Bold";
import { FunnelDisplay_700Bold } from "@expo-google-fonts/funnel-display/700Bold";
import { FunnelDisplay_800ExtraBold } from "@expo-google-fonts/funnel-display/800ExtraBold";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import * as SystemUI from "expo-system-ui";
import { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { SessionProvider } from "@/session";
import { roles, ThemeProvider } from "@/theme";

SplashScreen.preventAutoHideAsync();
// The window behind every screen is the ink ground, so nothing flashes white between screens.
SystemUI.setBackgroundColorAsync(roles.bg);

export default function RootLayout() {
  const [loaded, failed] = useFonts({
    FunnelDisplay_800ExtraBold,
    FunnelDisplay_700Bold,
    AtkinsonHyperlegibleNext_400Regular,
    AtkinsonHyperlegibleNext_700Bold,
  });
  const ready = loaded || Boolean(failed);

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: roles.bg }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <SessionProvider>
            <StatusBar style="light" />
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: roles.bg },
                animation: "fade",
              }}
            />
          </SessionProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
