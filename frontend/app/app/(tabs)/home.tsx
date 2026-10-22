import type { ActivityPage, UserSummary } from "@realm/contracts";
import { FlashList } from "@shopify/flash-list";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApi, usePosts } from "@/data";
import { Icon } from "@/icon";
import { api } from "@/server";
import { useSession } from "@/session";
import { Avatar, fillFor } from "@/social/avatar";
import { PostCard } from "@/social/post-card";
import { AppScreen, Empty, Loading, Problem } from "@/social/screen";
import { type NativeTheme, useStyles, useTheme } from "@/theme";
import { Sticker } from "@/themes/art";
import { Pill, Wordmark } from "@/ui";

/**
 * Home (the owner's pick, 2026-10-17: "like Instagram, opening on the posts of people you
 * follow"). New post on the left, the wordmark, the heart for activity; then the people row, then
 * the feed.
 */
export default function Home() {
  const { t } = useTheme();
  const s = useStyles(make);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const feed = usePosts("/feed");
  const [unread, setUnread] = useState(0);
  const { session } = useSession();
  const unconfirmed = session.status === "signedIn" && !session.user.emailVerified;

  useFocusEffect(
    useCallback(() => {
      api<ActivityPage>("/users/@me/activity")
        .then((a) => setUnread(a.unread))
        .catch(() => {});
    }, []),
  );

  const header = (
    <>
      <View style={[s.top, { paddingTop: insets.top + 2 }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="New post"
          onPress={() => router.push("/create")}
          style={s.icon}
        >
          <Icon name="PlusSquare" size={26} color={t.colors.text} />
        </Pressable>
        <View style={s.brand}>
          <Wordmark />
          <Sticker slot="header" size={34} />
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={unread ? `Activity, ${unread} new` : "Activity"}
          onPress={() => router.push("/activity")}
          style={s.icon}
        >
          <Icon name="Heart" size={26} color={t.colors.text} />
          {unread ? <View style={s.badge} /> : null}
        </Pressable>
      </View>
      {unconfirmed ? (
        <Pressable
          onPress={() => router.push("/verify-email")}
          accessibilityRole="link"
          style={({ pressed }) => [
            s.confirm,
            pressed && { backgroundColor: t.colors.surfaceRaised },
          ]}
        >
          <Icon name="EnvelopeSimple" size={22} color={t.colors.text} />
          <View style={s.confirmText}>
            <Text style={s.confirmTitle}>Confirm your email</Text>
            <Text style={s.confirmLine}>Use the 6-digit code we sent. It takes a moment.</Text>
          </View>
          <Icon name="CaretRight" size={18} color={t.colors.textSoft} />
        </Pressable>
      ) : null}
      <People />
    </>
  );

  return (
    <AppScreen>
      <FlashList
        data={feed.items}
        keyExtractor={(p) => p.id}
        renderItem={({ item }) => (
          <PostCard post={item} onChange={feed.update} onRemoved={feed.remove} />
        )}
        ListHeaderComponent={header}
        ListEmptyComponent={
          feed.loading ? (
            <Loading />
          ) : feed.error ? (
            <Problem message={feed.error} onRetry={feed.refresh} />
          ) : (
            <Empty
              title="Your Home is quiet."
              line="Follow people to see their posts here, or share the first one yourself."
            >
              <Pill label="Find people" onPress={() => router.push("/explore")} />
              <Pill kind="ghost" label="Share a post" onPress={() => router.push("/create")} />
            </Empty>
          )
        }
        onEndReached={feed.more}
        onEndReachedThreshold={0.6}
        refreshing={feed.refreshing && !feed.loading}
        onRefresh={feed.refresh}
      />
    </AppScreen>
  );
}

/**
 * The row under the header: you (tap to post), then the people you follow. Live rings come with
 * presence in the app; until then it never pretends anyone is live.
 */
function People() {
  const { t } = useTheme();
  const s = useStyles(make);
  const router = useRouter();
  const { session } = useSession();
  const me = session.status === "signedIn" ? session.user : null;
  const { data } = useApi<{ items: UserSummary[] }>(me ? `/users/${me.username}/following` : null);
  if (!me) return null;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={s.people}
      style={s.peopleRow}
    >
      <Pressable
        onPress={() => router.push("/create")}
        accessibilityRole="button"
        accessibilityLabel="Your post: share something"
        style={s.person}
      >
        <View>
          <Avatar user={me} size={64} />
          <View style={s.plus}>
            <Icon name="PlusBold" size={14} color={t.colors.bg} />
          </View>
        </View>
        <Text style={s.personName} numberOfLines={1}>
          You
        </Text>
      </Pressable>
      {data?.items.map((u) => (
        <Pressable
          key={u.id}
          onPress={() =>
            router.push({ pathname: "/user/[username]", params: { username: u.username } })
          }
          accessibilityRole="link"
          accessibilityLabel={u.displayName}
          style={s.person}
        >
          <Face user={u} />
          {t.style.stories === "bands" ? null : (
            <Text style={s.personName} numberOfLines={1}>
              {u.displayName.split(" ")[0]}
            </Text>
          )}
        </Pressable>
      ))}
    </ScrollView>
  );
}

/** A person in the row, in the theme's story style. */
function Face({ user }: { user: UserSummary }) {
  const { t } = useTheme();
  const s = useStyles(make);
  const colour = user.accentColor
    ? `#${user.accentColor.toString(16).padStart(6, "0")}`
    : fillFor(user.id);
  if (t.style.stories === "bands") {
    return (
      <View style={s.band}>
        <Avatar user={user} size={84} square />
        <View style={[s.bandStrip, { backgroundColor: colour }]}>
          <Text style={s.bandName} numberOfLines={1}>
            {user.displayName.split(" ")[0]}
          </Text>
        </View>
      </View>
    );
  }
  if (t.style.stories === "thin") {
    return (
      <View style={s.thin}>
        <Avatar user={user} size={60} />
      </View>
    );
  }
  return (
    <LinearGradient
      colors={[colour, t.colors.lights[1], colour]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={s.ring}
    >
      <View style={s.ringGap}>
        <Avatar user={user} size={58} />
      </View>
    </LinearGradient>
  );
}

const make = (t: NativeTheme) =>
  StyleSheet.create({
    confirm: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      marginHorizontal: 12,
      marginTop: 4,
      marginBottom: 6,
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderRadius: 16,
      borderWidth: 1.5,
      borderColor: t.colors.border,
      backgroundColor: t.colors.surface,
    },
    confirmText: { flex: 1 },
    confirmTitle: { fontFamily: t.fonts.bold, fontSize: 15.5 * t.textScale, color: t.colors.text },
    confirmLine: {
      fontFamily: t.fonts.body,
      fontSize: 13.5 * t.textScale,
      color: t.colors.textSoft,
      marginTop: 2,
    },
    top: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 4,
    },
    icon: { width: 48, height: 48, alignItems: "center", justifyContent: "center" },
    badge: {
      position: "absolute",
      top: 10,
      right: 10,
      width: 9,
      height: 9,
      borderRadius: 5,
      backgroundColor: "#ff5f7a",
      borderWidth: 1.5,
      borderColor: t.colors.bg,
    },
    peopleRow: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.colors.border,
    },
    people: { paddingHorizontal: 12, paddingTop: 6, paddingBottom: 12, gap: 14 },
    person: { alignItems: "center", gap: 6, minWidth: 70 },
    brand: { flexDirection: "row", alignItems: "center", gap: 6 },
    ring: { width: 68, height: 68, borderRadius: 34, padding: 2.5 },
    ringGap: {
      flex: 1,
      borderRadius: 32,
      padding: 2.5,
      backgroundColor: t.colors.bg,
      alignItems: "center",
      justifyContent: "center",
    },
    thin: { borderRadius: 34, borderWidth: 1.5, borderColor: t.colors.text, padding: 3 },
    band: {
      width: 84,
      height: 118,
      borderRadius: t.radius.card,
      overflow: "hidden",
      backgroundColor: t.colors.surfaceRaised,
    },
    bandStrip: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      height: 26,
      justifyContent: "center",
      paddingHorizontal: 8,
    },
    bandName: {
      fontFamily: t.fonts.display,
      fontSize: 11 * t.textScale,
      letterSpacing: 0.8,
      textTransform: "uppercase",
      color: "#0b0b0e",
    },
    personName: {
      fontFamily: t.fonts.body,
      fontSize: 12.5 * t.textScale,
      color: t.colors.textSoft,
      maxWidth: 70,
    },
    plus: {
      position: "absolute",
      right: -2,
      bottom: -2,
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: t.colors.text,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 3,
      borderColor: t.colors.bg,
    },
  });
