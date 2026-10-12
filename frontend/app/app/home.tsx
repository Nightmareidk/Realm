import { Redirect, useRouter } from "expo-router";
import { useState } from "react";
import { Linking, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LightField } from "@/light-field";
import { webOrigin } from "@/server";
import { useSession } from "@/session";
import { fonts, roles, themes, useTheme } from "@/theme";
import { Lead, Pill, Wordmark } from "@/ui";

/**
 * Signed in. The app's Home, Spaces and Messages are the next build; until then this says so
 * plainly and points to the website, where they work today.
 */
export default function Home() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session, signOut } = useSession();
  const { id } = useTheme();
  const [leaving, setLeaving] = useState(false);
  if (session.status === "signedOut") return <Redirect href="/" />;
  if (session.status !== "signedIn") return <View style={s.screen} />;
  const { user } = session;
  const web = webOrigin();

  return (
    <View style={s.screen}>
      <LightField />
      <View style={[s.body, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 20 }]}>
        <Wordmark />
        <View style={s.middle}>
          <Text accessibilityRole="header" style={s.greeting}>
            Hey, {user.displayName}
          </Text>
          <Lead style={s.lead}>
            You're signed in on your phone as @{user.username}, in {themes[id].name}. Home, Spaces
            and Messages come to the app next. For now they're on the website.
          </Lead>
          {!user.emailVerified ? (
            <Text style={s.note}>Check your email to confirm your address.</Text>
          ) : null}
        </View>
        <View style={s.actions}>
          {web ? (
            <Pill
              label="Open Realm on the website"
              onPress={() => Linking.openURL(`${web}/home`)}
            />
          ) : null}
          <Pill
            kind="ghost"
            label="Sign out"
            pendingLabel="Signing out"
            pending={leaving}
            onPress={async () => {
              setLeaving(true);
              await signOut();
              router.replace("/");
            }}
          />
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: roles.bg },
  body: { flex: 1, paddingHorizontal: 24 },
  middle: { flex: 1, justifyContent: "center" },
  greeting: {
    fontFamily: fonts.displayBold,
    fontSize: 34,
    lineHeight: 38,
    color: roles.text,
    letterSpacing: -0.8,
  },
  lead: { marginTop: 14 },
  note: { fontFamily: fonts.bold, fontSize: 15, color: roles.text, marginTop: 18 },
  actions: { gap: 12 },
});
