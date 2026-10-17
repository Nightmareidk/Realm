import { Redirect, Tabs } from "expo-router";
import { View } from "react-native";
import { useSession } from "@/session";
import { TabBar } from "@/tab-bar";
import { roles } from "@/theme";

/** The signed-in app: Home, Clips, Explore, Inbox and You. */
export default function TabsLayout() {
  const { session } = useSession();
  if (session.status === "loading") return <View style={{ flex: 1, backgroundColor: roles.bg }} />;
  if (session.status === "signedOut") return <Redirect href="/" />;
  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: roles.bg },
        animation: "fade",
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
