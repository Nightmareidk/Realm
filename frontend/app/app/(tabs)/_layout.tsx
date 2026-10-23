import { Redirect, Tabs } from "expo-router";
import { View } from "react-native";
import { CrashScreen } from "@/crash";
import { useWide } from "@/layout";
import { useSession } from "@/session";
import { TabBar } from "@/tab-bar";
import { roles } from "@/theme";

/** A crash inside a tab is caught here, so the rest of the app keeps going. */
export const ErrorBoundary = CrashScreen;

/** The signed-in app: Home, Clips, Explore, Inbox and You. */
export default function TabsLayout() {
  const { session } = useSession();
  // On a computer the tabs become a menu down the left.
  const wide = useWide();
  if (session.status === "loading") return <View style={{ flex: 1, backgroundColor: roles.bg }} />;
  if (session.status === "signedOut") return <Redirect href="/" />;
  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: roles.bg },
        animation: "fade",
        // On a computer the tabs give way to the menu down the left (app/_layout).
        tabBarStyle: wide ? { display: "none" } : undefined,
      }}
    >
      <Tabs.Screen name="home" />
      <Tabs.Screen name="clips" />
      <Tabs.Screen name="explore" />
      <Tabs.Screen name="inbox" />
      <Tabs.Screen name="you" />
    </Tabs>
  );
}
