import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon } from "@/icon";
import { useSession } from "@/session";
import { ProfileView } from "@/social/profile-view";
import { AppScreen } from "@/social/screen";
import { type NativeTheme, useStyles, useTheme } from "@/theme";

/** You: your own profile, with New post and Settings in its top bar. */
export default function You() {
  const { t } = useTheme();
  const s = useStyles(make);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session } = useSession();
  if (session.status !== "signedIn") return null;
  const top = (
    <View style={[s.top, { paddingTop: insets.top + 2 }]}>
      <Text style={s.title} numberOfLines={1} accessibilityRole="header">
        @{session.user.username}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="New post"
        onPress={() => router.push("/create")}
        style={s.icon}
      >
        <Icon name="PlusSquare" size={25} color={t.colors.text} />
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Settings"
        onPress={() => router.push("/settings")}
        style={s.icon}
      >
        <Icon name="Gear" size={25} color={t.colors.text} />
      </Pressable>
    </View>
  );
  return (
    <AppScreen max={935}>
      <ProfileView username={session.user.username} top={top} />
    </AppScreen>
  );
}

const make = (t: NativeTheme) =>
  StyleSheet.create({
    top: { flexDirection: "row", alignItems: "center", paddingLeft: 16, paddingRight: 4 },
    title: {
      flex: 1,
      fontFamily: t.fonts.displayBold,
      fontSize: 21 * t.textScale,
      color: t.colors.text,
    },
    icon: { width: 48, height: 48, alignItems: "center", justifyContent: "center" },
  });
