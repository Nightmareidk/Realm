import type { Profile, UserSettings } from "@realm/contracts";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { useApi } from "@/data";
import { Icon } from "@/icon";
import { ApiError, api } from "@/server";
import { useSession } from "@/session";
import { AppScreen, Loading, TopBar } from "@/social/screen";
import { fonts, roles, THEME_ORDER, themes, useTheme } from "@/theme";
import { Field, Pill } from "@/ui";

/** Settings: who can see you, personal or business, your colour, and signing out. */
export default function Settings() {
  const router = useRouter();
  const { session, signOut } = useSession();
  const me = session.status === "signedIn" ? session.user : null;
  const { id: themeId, setTheme, accent } = useTheme();
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

  async function pickColour(id: (typeof THEME_ORDER)[number]) {
    setTheme(id);
    await api("/users/@me/settings", { method: "PATCH", body: { accent: id } }).catch(() => {});
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
          <Icon name="CaretRight" size={20} color={roles.textSoft} />
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
              <View style={[s.radio, on && { borderColor: roles.text }]}>
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

        <Text style={s.heading}>Your colour</Text>
        <View style={s.swatches} accessibilityRole="radiogroup">
          {THEME_ORDER.map((t) => {
            const [l1, l2, l3] = themes[t].lights;
            const on = t === themeId;
            return (
              <Pressable
                key={t}
                onPress={() => pickColour(t)}
                accessibilityRole="radio"
                accessibilityLabel={themes[t].name}
                accessibilityState={{ checked: on }}
                style={[s.swatchWrap, on && s.swatchOn]}
              >
                <LinearGradient
                  colors={[l1, l2, l3]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={s.swatch}
                >
                  <Text style={s.swatchName}>{themes[t].name}</Text>
                </LinearGradient>
              </Pressable>
            );
          })}
        </View>

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

const s = StyleSheet.create({
  body: { padding: 16, paddingBottom: 48 },
  fill: { flex: 1 },
  linkRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 52,
  },
  linkText: { fontFamily: fonts.bold, fontSize: 16, color: roles.text },
  heading: {
    fontFamily: fonts.displayBold,
    fontSize: 19,
    color: roles.text,
    marginTop: 26,
    marginBottom: 10,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 14 },
  title: { fontFamily: fonts.bold, fontSize: 15.5, color: roles.text },
  line: {
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
    color: roles.textSoft,
    marginTop: 2,
  },
  choice: {
    flexDirection: "row",
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: roles.border,
    marginBottom: 8,
  },
  choiceOn: { borderColor: roles.text, backgroundColor: roles.surfaceRaised },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: roles.borderStrong,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: roles.text },
  business: { gap: 16, marginTop: 8 },
  swatches: { flexDirection: "row", gap: 10 },
  swatchWrap: { flex: 1, borderRadius: 16, padding: 3, borderWidth: 2, borderColor: "transparent" },
  swatchOn: { borderColor: roles.text },
  swatch: { height: 72, borderRadius: 12, justifyContent: "flex-end", padding: 8 },
  swatchName: { fontFamily: fonts.bold, fontSize: 13, color: "#ffffff" },
  signOut: { marginTop: 36 },
});
