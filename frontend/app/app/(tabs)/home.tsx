import type { ActivityPage, UserSummary } from "@realm/contracts";
import { FlashList } from "@shopify/flash-list";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApi, usePosts } from "@/data";
import { Icon } from "@/icon";
import { api } from "@/server";
import { useSession } from "@/session";
import { Avatar } from "@/social/avatar";
import { PostCard } from "@/social/post-card";
import { AppScreen, Empty, Loading, Problem } from "@/social/screen";
import { fonts, roles } from "@/theme";
import { Pill, Wordmark } from "@/ui";

/**
 * Home (the owner's pick, 2026-10-17: "like Instagram, opening on the posts of people you
 * follow"). New post on the left, the wordmark, the heart for activity; then the people row, then
 * the feed.
 */
export default function Home() {
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
          <Icon name="PlusSquare" size={26} color={roles.text} />
        </Pressable>
        <Wordmark />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={unread ? `Activity, ${unread} new` : "Activity"}
          onPress={() => router.push("/activity")}
          style={s.icon}
        >
          <Icon name="Heart" size={26} color={roles.text} />
          {unread ? <View style={s.badge} /> : null}
        </Pressable>
      </View>
      {unconfirmed ? (
        <Pressable
          onPress={() => router.push("/verify-email")}
          accessibilityRole="link"
          style={({ pressed }) => [s.confirm, pressed && { backgroundColor: roles.surfaceRaised }]}
        >
          <Icon name="EnvelopeSimple" size={22} color={roles.text} />
          <View style={s.confirmText}>
            <Text style={s.confirmTitle}>Confirm your email</Text>
            <Text style={s.confirmLine}>Use the 6-digit code we sent. It takes a moment.</Text>
          </View>
          <Icon name="CaretRight" size={18} color={roles.textSoft} />
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
            <Icon name="PlusBold" size={14} color={roles.bg} />
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
          <Avatar user={u} size={64} />
          <Text style={s.personName} numberOfLines={1}>
            {u.displayName.split(" ")[0]}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const s = StyleSheet.create({
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
    borderColor: roles.border,
    backgroundColor: roles.surface,
  },
  confirmText: { flex: 1 },
  confirmTitle: { fontFamily: fonts.bold, fontSize: 15.5, color: roles.text },
  confirmLine: { fontFamily: fonts.body, fontSize: 13.5, color: roles.textSoft, marginTop: 2 },
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
    borderColor: roles.bg,
  },
  peopleRow: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: roles.border,
  },
  people: { paddingHorizontal: 12, paddingTop: 6, paddingBottom: 12, gap: 14 },
  person: { alignItems: "center", gap: 6, width: 70 },
  personName: { fontFamily: fonts.body, fontSize: 12.5, color: roles.textSoft, maxWidth: 70 },
  plus: {
    position: "absolute",
    right: -2,
    bottom: -2,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: roles.text,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: roles.bg,
  },
});
