// Must run first: the phone needs native WebCrypto before any encryption code loads.
import "@/native-crypto";
import { AtkinsonHyperlegibleNext_400Regular } from "@expo-google-fonts/atkinson-hyperlegible-next/400Regular";
import { AtkinsonHyperlegibleNext_700Bold } from "@expo-google-fonts/atkinson-hyperlegible-next/700Bold";
import { FunnelDisplay_700Bold } from "@expo-google-fonts/funnel-display/700Bold";
import { FunnelDisplay_800ExtraBold } from "@expo-google-fonts/funnel-display/800ExtraBold";
import { Gabarito_700Bold } from "@expo-google-fonts/gabarito/700Bold";
import { Gabarito_800ExtraBold } from "@expo-google-fonts/gabarito/800ExtraBold";
import { RethinkSans_400Regular } from "@expo-google-fonts/rethink-sans/400Regular";
import { RethinkSans_700Bold } from "@expo-google-fonts/rethink-sans/700Bold";
import { useFonts } from "expo-font";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import * as SystemUI from "expo-system-ui";
import { type ReactNode, useEffect } from "react";
import { View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { CrashScreen } from "@/crash";
import { useWide } from "@/layout";
import { PushTaps } from "@/push-taps";
import { Rail } from "@/rail";
import { SessionProvider, useSession } from "@/session";
import { SheetProvider } from "@/sheet";
import { roles, ThemeProvider } from "@/theme";
import { TourProvider } from "@/tour";

SplashScreen.preventAutoHideAsync();

/** A crash anywhere in the app shows a plain "Something went wrong" with a way to try again. */
export const ErrorBoundary = CrashScreen;
// The window behind every screen is the ink ground, so nothing flashes white between screens.
SystemUI.setBackgroundColorAsync(roles.bg);

export default function RootLayout() {
  const [loaded, failed] = useFonts({
    FunnelDisplay_800ExtraBold,
    FunnelDisplay_700Bold,
    AtkinsonHyperlegibleNext_400Regular,
    AtkinsonHyperlegibleNext_700Bold,
    // Afterglow's fonts, the default, so the app opens in them without a flash.
    Gabarito_800ExtraBold,
    Gabarito_700Bold,
    RethinkSans_400Regular,
    RethinkSans_700Bold,
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
            <SheetProvider>
              <StatusBar style="light" />
              <PushTaps />
              <TourProvider>
                <SessionGate>
                  <Stack
                    screenOptions={{
                      headerShown: false,
                      contentStyle: { backgroundColor: roles.bg },
                    }}
                  >
                    <Stack.Screen name="index" options={{ animation: "fade" }} />
                    <Stack.Screen name="(tabs)" options={{ animation: "fade" }} />
                    <Stack.Screen name="create" options={{ presentation: "modal" }} />
                    <Stack.Screen
                      name="stories"
                      options={{
                        presentation: "fullScreenModal",
                        animation: "fade",
                        contentStyle: { backgroundColor: "#000000" },
                      }}
                    />
                    <Stack.Screen name="report" options={{ presentation: "modal" }} />
                    <Stack.Screen
                      name="player"
                      options={{ presentation: "fullScreenModal", animation: "slide_from_bottom" }}
                    />
                  </Stack>
                </SessionGate>
              </TourProvider>
            </SheetProvider>
          </SessionProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

/** The screens anyone can open, signed in or not. */
const OPEN = new Set(["index", "sign-in", "sign-up", "forgot", "+not-found"]);
// Developer builds only: the layout checks under /dev open without signing in.
if (__DEV__) OPEN.add("dev");

/**
 * Nothing loads until we know who's signed in, so no screen asks the API as nobody. And when the
 * session ends while you're in (signed out from another device), you're taken back to the start.
 */
function SessionGate({ children }: { children: ReactNode }) {
  const { session } = useSession();
  const segments = useSegments();
  const router = useRouter();
  const inside = segments.length > 0 && !OPEN.has(segments[0] ?? "");
  useEffect(() => {
    if (session.status === "signedOut" && inside) router.replace("/");
  }, [session.status, inside, router]);
  const wide = useWide();
  if (session.status === "loading") return <View style={{ flex: 1, backgroundColor: roles.bg }} />;
  // On a computer, signed in: the menu down the left beside every screen, as Instagram does.
  if (wide && session.status === "signedIn" && inside) {
    return (
      <View style={{ flex: 1, flexDirection: "row", backgroundColor: roles.bg }}>
        <Rail />
        <View style={{ flex: 1 }}>{children}</View>
      </View>
    );
  }
  return children;
}
