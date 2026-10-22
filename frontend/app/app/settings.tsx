import type { Profile, UserSettings } from "@realm/contracts";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { useApi } from "@/data";
import { Icon } from "@/icon";
import type { IconName } from "@/icon-paths";
import { ApiError, api } from "@/server";
import { useSession } from "@/session";
import { AppScreen, Loading, TopBar } from "@/social/screen";
import { fonts, type NativeTheme, useStyles, useTheme } from "@/theme";
import { Field, Pill } from "@/ui";

/**
 * Settings: who can see you, personal or business, your colour, keeping the account safe (email,
 * password, where you're signed in, who you've blocked), and signing out.
 */
export default function Settings() {
  const { t } = useTheme();
  const s = useStyles(make);
  const router = useRouter();
  const { session, signOut } = useSession();
  const me = session.status === "signedIn" ? session.user : null;
  const { accent } = useTheme();
  const settings = useApi<UserSettings>("/users/@me/settings");
  const profile = useApi<Profile>(me ? `/users/${me.username}/profile` : null);
  const [category, setCategory] = useState("");
  const [site, setSite] = useState("");
  const [saving, setSaving] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (profile.data) {
      setCategory(profile.data.category ?? "");
      setSite(profile.data.websiteUrl ?? "");
    }
  }, [profile.data]);

  if (!settings.data || !profile.data) {
    return (
      <AppScreen>
        <TopBar title="Settings" />
        <Loading />
      </AppScreen>
    );
  }
  const business = profile.data.accountKind === "business";

  async function setPrivate(on: boolean) {
    if (!settings.data) return;
    settings.setData({ ...settings.data, profileVisibility: on ? "private" : "public" });
    try {
      settings.setData(
        await api<UserSettings>("/users/@me/settings", {
          method: "PATCH",
          body: { profileVisibility: on ? "private" : "public" },
        }),
      );
      profile.reload();
    } catch (err) {
      settings.reload();
      Alert.alert("Not changed", err instanceof ApiError ? err.message : "Try again.");
    }
  }

  async function setKind(kind: "personal" | "business", extra: object = {}) {
    setSaving(true);
    try {
      profile.setData(
        await api<Profile>("/users/@me/account", {
          method: "PATCH",
          body: { accountKind: kind, ...extra },
        }),
      );
      settings.reload();
    } catch (err) {
      Alert.alert("Not saved", err instanceof ApiError ? err.message : "Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppScreen>
      <TopBar title="Settings" />
      <ScrollView contentContainerStyle={s.body}>
        <Pressable
          onPress={() => router.push("/edit-profile")}
          accessibilityRole="link"
          style={s.linkRow}
        >
          <Text style={s.linkText}>Edit profile</Text>
          <Icon name="CaretRight" size={20} color={t.colors.textSoft} />
        </Pressable>

        <Text style={s.heading}>Who can see you</Text>
        <View style={s.row}>
          <View style={s.fill}>
            <Text style={s.title}>Private account</Text>
            <Text style={s.line}>
              {business
                ? "Business accounts are always public."
                : "Only people you approve see your posts and Clips. Any post you mark public still shows to everyone."}
            </Text>
          </View>
          <Switch
            value={!business && settings.data.profileVisibility === "private"}
            onValueChange={setPrivate}
            disabled={business}
            trackColor={{ true: accent }}
            accessibilityLabel="Private account"
          />
        </View>

        <Text style={s.heading}>Account type</Text>
        {(["personal", "business"] as const).map((k) => {
          const on = profile.data?.accountKind === k;
          return (
            <Pressable
              key={k}
              onPress={() => !on && setKind(k)}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              style={[s.choice, on && s.choiceOn]}
            >
              <View style={[s.radio, on && { borderColor: t.colors.text }]}>
                {on ? <View style={s.radioDot} /> : null}
              </View>
              <View style={s.fill}>
                <Text style={s.title}>{k === "personal" ? "Personal" : "Business"}</Text>
                <Text style={s.line}>
                  {k === "personal"
                    ? "For you and your friends. Can be private."
                    : "For teams, creators and shops: always public, with a category and a link."}
                </Text>
              </View>
            </Pressable>
          );
        })}
        {business ? (
          <View style={s.business}>
            <Field
              label="Category"
              hint="What you are, like Esports team or Game shop."
              value={category}
              onChangeText={setCategory}
              maxLength={40}
            />
            <Field
              label="Website"
              hint="Starts with https://"
              value={site}
              onChangeText={setSite}
              autoCapitalize="none"
              keyboardType="url"
            />
            <Pill
              size="md"
              kind="ghost"
              label="Save business details"
              pending={saving}
              pendingLabel="Saving"
              onPress={() =>
                setKind("business", {
                  category: category.trim() || null,
                  websiteUrl: site.trim() || null,
                })
              }
            />
          </View>
        ) : null}

        <Text style={s.heading}>Look</Text>
        <NavRow
          icon="Palette"
          title="Themes"
          line="Now Playing, Wristband, Plain and clear, your colour, and themes people made"
          onPress={() => router.push("/themes")}
        />

        <Text style={s.heading}>Security and login</Text>
        <NavRow
          icon="EnvelopeSimple"
          title="Email"
          line={me?.emailVerified ? `${me.email} · Confirmed` : `${me?.email} · Not confirmed yet`}
          warn={!me?.emailVerified}
          onPress={() => router.push("/verify-email")}
        />
        <NavRow
          icon="Password"
          title="Password"
          line="Change it, and sign out your other devices"
          onPress={() => router.push("/change-password")}
        />
        <NavRow
          icon="DeviceMobile"
          title="Where you're signed in"
          line="Your phones and browsers, and signing one out"
          onPress={() => router.push("/devices")}
        />
        <NavRow
          icon="Prohibit"
          title="Blocked accounts"
          line="People who can't see you or message you"
          onPress={() => router.push("/blocked")}
        />

        <View style={s.signOut}>
          <Pill
            kind="ghost"
            label="Sign out"
            pending={leaving}
            pendingLabel="Signing out"
            onPress={async () => {
              setLeaving(true);
              await signOut();
              router.replace("/");
            }}
          />
        </View>
      </ScrollView>
    </AppScreen>
  );
}

/** A row that opens another settings screen: what it is, where it stands, and a caret. */
function NavRow({
  icon,
  title,
  line,
  warn,
  onPress,
}: {
  icon: IconName;
  title: string;
  line: string;
  /** Needs doing: the line says so in the danger colour, and in words. */
  warn?: boolean;
  onPress: () => void;
}) {
  const { t } = useTheme();
  const s = useStyles(make);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="link"
      accessibilityLabel={`${title}. ${line}`}
      style={({ pressed }) => [s.navRow, pressed && s.navRowPressed]}
    >
      <View style={s.navMark}>
        <Icon name={icon} size={21} color={t.colors.text} />
      </View>
      <View style={s.fill}>
        <Text style={s.title}>{title}</Text>
        <Text style={[s.line, warn && { color: t.colors.danger }]} numberOfLines={1}>
          {line}
        </Text>
      </View>
      <Icon name="CaretRight" size={18} color={t.colors.textSoft} />
    </Pressable>
  );
}

const make = (t: NativeTheme) =>
  StyleSheet.create({
    body: { padding: 16, paddingBottom: 48 },
    navRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      minHeight: 64,
      marginHorizontal: -8,
      paddingHorizontal: 8,
      borderRadius: 14,
    },
    navRowPressed: { backgroundColor: t.colors.surfaceRaised },
    navMark: {
      width: 40,
      height: 40,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: t.colors.surfaceRaised,
    },
    fill: { flex: 1 },
    linkRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      minHeight: 52,
    },
    linkText: { fontFamily: fonts.bold, fontSize: 16, color: t.colors.text },
    heading: {
      fontFamily: fonts.displayBold,
      fontSize: 19,
      color: t.colors.text,
      marginTop: 26,
      marginBottom: 10,
    },
    row: { flexDirection: "row", alignItems: "center", gap: 14 },
    title: { fontFamily: fonts.bold, fontSize: 15.5, color: t.colors.text },
    line: {
      fontFamily: fonts.body,
      fontSize: 14,
      lineHeight: 20,
      color: t.colors.textSoft,
      marginTop: 2,
    },
    choice: {
      flexDirection: "row",
      gap: 12,
      padding: 14,
      borderRadius: 14,
      borderWidth: 1.5,
      borderColor: t.colors.border,
      marginBottom: 8,
    },
    choiceOn: { borderColor: t.colors.text, backgroundColor: t.colors.surfaceRaised },
    radio: {
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 2,
      borderColor: t.colors.borderStrong,
      alignItems: "center",
      justifyContent: "center",
      marginTop: 2,
    },
    radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: t.colors.text },
    business: { gap: 16, marginTop: 8 },
    swatches: { flexDirection: "row", gap: 10 },
    swatchWrap: {
      flex: 1,
      borderRadius: 16,
      padding: 3,
      borderWidth: 2,
      borderColor: "transparent",
    },
    swatchOn: { borderColor: t.colors.text },
    swatch: { height: 72, borderRadius: 12, justifyContent: "flex-end", padding: 8 },
    swatchName: { fontFamily: fonts.bold, fontSize: 13, color: "#ffffff" },
    signOut: { marginTop: 36 },
  });
