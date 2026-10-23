import type { ActivityPage, Post, UserSummary } from "@realm/contracts";
import { FlashList, type ViewToken } from "@shopify/flash-list";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApi, usePosts } from "@/data";
import { Icon } from "@/icon";
import { useLiveEvent } from "@/live";
import { feedPlay, feedStop } from "@/music/player";
import { loadStories, useStories } from "@/music/stories";
import { api, mediaSource } from "@/server";
import { useSession } from "@/session";
import { useSheet } from "@/sheet";
import { Avatar, fillFor } from "@/social/avatar";
import { PostCard } from "@/social/post-card";
import { AppScreen, Empty, Loading, Problem } from "@/social/screen";
import { type NativeTheme, useStyles, useTheme } from "@/theme";
import { Sticker } from "@/themes/art";
import { Pill, Wordmark } from "@/ui";

/**
 * Home (the owner's pick, 2026-10-17: "like Instagram, opening on the posts of people you
 * follow"). The wordmark, then the heart for activity and + to make something (Post, Story or
 * Clip); then Stories, then the feed. In Now Playing, the photo you're looking at lights the
 * whole screen in its own colours.
 */
export default function Home() {
  const { t } = useTheme();
  const s = useStyles(make);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const feed = usePosts("/feed");
  const [unread, setUnread] = useState(0);
  // A new like, comment or follower lights the heart straight away.
  useLiveEvent("ACTIVITY_NEW", (d) => setUnread(d.unread));
  const { session } = useSession();
  const unconfirmed = session.status === "signedIn" && !session.user.emailVerified;
  const sheet = useSheet();
  // The photo on screen, whose colours light the room (Now Playing's glow).
  const lit = t.style.posts === "glow" && t.style.glow > 0;
  const [ambient, setAmbient] = useState<string | null>(null);
  const onViewable = useRef(({ viewableItems }: { viewableItems: ViewToken<Post>[] }) => {
    const photo = viewableItems.find((v) => v.item?.kind === "image")?.item?.media[0];
    if (photo) setAmbient(photo.url);
    // Like Instagram: the post on screen plays its song by itself.
    const withSong = viewableItems.find((v) => v.item?.sound && v.item.kind !== "clip")?.item;
    if (withSong?.sound)
      feedPlay(withSong.sound, withSong.id, `${withSong.author.displayName}'s post`);
    else feedStop();
  }).current;

  function create() {
    const go = (mode: "post" | "story" | "clip") =>
      router.push({ pathname: "/create", params: { mode } });
    sheet({
      title: "Create",
      actions: [
        { label: "Post", icon: "GridFour", onPress: () => go("post") },
        { label: "Story", icon: "Camera", onPress: () => go("story") },
        { label: "Clip", icon: "PlayCircle", onPress: () => go("clip") },
      ],
    });
  }

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
        <View style={s.brand}>
          <Wordmark />
          <Sticker slot="header" size={34} />
        </View>
        <View style={s.topRight}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={unread ? `Activity, ${unread} new` : "Activity"}
            onPress={() => router.push("/activity")}
            style={s.icon}
          >
            <Icon name="Heart" size={26} color={t.colors.text} />
            {unread ? <View style={s.badge} /> : null}
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Create: a post, a Story or a Clip"
            onPress={create}
            style={s.icon}
          >
            <Icon name="PlusSquare" size={26} color={t.colors.text} />
          </Pressable>
        </View>
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
      <StoriesRow />
    </>
  );

  return (
    <AppScreen>
      {lit && ambient ? (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <Image
            source={mediaSource(ambient)}
            style={[StyleSheet.absoluteFill, { opacity: 0.3 + t.style.glow * 0.3 }]}
            blurRadius={60}
            contentFit="cover"
            transition={700}
            accessible={false}
          />
          <LinearGradient
            colors={["transparent", t.colors.bg]}
            start={{ x: 0.5, y: 0.55 }}
            end={{ x: 0.5, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        </View>
      ) : null}
      <FlashList
        onViewableItemsChanged={onViewable}
        viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
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
              <Pill kind="ghost" label="Share a post" onPress={create} />
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
 * Stories, under the header: you first (tap the plus to add one), then people you follow with
 * Stories, new ones first, then the rest of the people you follow, so the row is never empty.
 */
function StoriesRow() {
  const { t } = useTheme();
  const s = useStyles(make);
  const router = useRouter();
  const { session } = useSession();
  const me = session.status === "signedIn" ? session.user : null;
  const rings = useStories();
  const { data } = useApi<{ items: UserSummary[] }>(me ? `/users/${me.username}/following` : null);
  useFocusEffect(
    useCallback(() => {
      loadStories();
    }, []),
  );
  if (!me) return null;
  const mine = rings?.find((r) => r.author.id === me.id);
  const others = rings?.filter((r) => r.author.id !== me.id) ?? [];
  const withStory = new Set(others.map((r) => r.author.id));
  const rest = (data?.items ?? []).filter((u) => !withStory.has(u.id));
  const watch = (id: string) => router.push({ pathname: "/stories", params: { start: id } });
  const add = () => router.push({ pathname: "/create", params: { mode: "story" } });
  const named = t.style.stories !== "bands";
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={s.people}
      style={s.peopleRow}
    >
      <View style={s.person}>
        <Pressable
          onPress={mine ? () => watch(me.id) : add}
          accessibilityRole="button"
          accessibilityLabel={mine ? "Your Story" : "Add to your Story"}
        >
          <Face user={me} state={mine ? "new" : "none"} />
        </Pressable>
        <Pressable
          onPress={add}
          accessibilityRole="button"
          accessibilityLabel="Add to your Story"
          hitSlop={6}
          style={[s.plus, t.style.stories === "bands" && s.plusBand]}
        >
          <Icon name="PlusBold" size={14} color={t.colors.bg} />
        </Pressable>
        {named ? (
          <Text style={s.personName} numberOfLines={1}>
            Your Story
          </Text>
        ) : null}
      </View>
      {others.map((r) => (
        <Pressable
          key={r.author.id}
          onPress={() => watch(r.author.id)}
          accessibilityRole="button"
          accessibilityLabel={`${r.author.displayName}'s Story${r.unseen ? ", new" : ""}`}
          style={s.person}
        >
          <Face
            user={r.author}
            state={r.unseen ? "new" : "seen"}
            cover={r.stories.findLast((st) => st.sound?.coverUrl)?.sound?.coverUrl ?? null}
          />
          {named ? (
            <Text style={[s.personName, r.unseen && s.personNew]} numberOfLines={1}>
              {r.author.displayName.split(" ")[0]}
            </Text>
          ) : null}
        </Pressable>
      ))}
      {rest.map((u) => (
        <Pressable
          key={u.id}
          onPress={() =>
            router.push({ pathname: "/user/[username]", params: { username: u.username } })
          }
          accessibilityRole="link"
          accessibilityLabel={u.displayName}
          style={s.person}
        >
          <Face user={u} state="none" />
          {named ? (
            <Text style={s.personName} numberOfLines={1}>
              {u.displayName.split(" ")[0]}
            </Text>
          ) : null}
        </Pressable>
      ))}
    </ScrollView>
  );
}

/**
 * A person in the row, in the theme's story style: a lit ring (Now Playing), a wristband tile
 * (Wristband) or a fine line (Plain and clear). A new Story is the strongest mark; one you've
 * seen is quieter; no Story, nothing.
 */
function Face({
  user,
  state,
  cover = null,
}: {
  user: UserSummary;
  state: "new" | "seen" | "none";
  /** The song on their newest Story, shown on the ring (Now Playing). */
  cover?: string | null;
}) {
  const { t } = useTheme();
  const s = useStyles(make);
  const colour = user.accentColor
    ? `#${user.accentColor.toString(16).padStart(6, "0")}`
    : fillFor(user.id);
  if (t.style.stories === "bands") {
    return (
      <View style={[s.band, state === "new" && s.bandNew, state === "none" && s.bandNone]}>
        <Avatar user={user} size={84} square />
        <View
          style={[
            s.bandStrip,
            { backgroundColor: state === "none" ? t.colors.surfaceRaised : colour },
          ]}
        >
          <Text style={[s.bandName, state === "none" && s.bandNameNone]} numberOfLines={1}>
            {user.displayName.split(" ")[0]}
          </Text>
        </View>
      </View>
    );
  }
  if (t.style.stories === "thin") {
    return (
      <View style={[s.thin, state === "new" ? s.thinNew : state === "seen" ? s.thinSeen : null]}>
        <Avatar user={user} size={60} />
      </View>
    );
  }
  const disc = cover ? (
    <View style={s.disc}>
      <Image
        source={cover.startsWith("/") ? mediaSource(cover) : { uri: cover }}
        style={s.discImage}
        contentFit="cover"
        recyclingKey={cover}
      />
    </View>
  ) : null;
  if (state === "new") {
    return (
      <View>
        <LinearGradient
          colors={[colour, t.colors.lights[1], t.colors.accent]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={s.ring}
        >
          <View style={s.ringGap}>
            <Avatar user={user} size={58} />
          </View>
        </LinearGradient>
        {disc}
      </View>
    );
  }
  return (
    <View style={[s.ring, state === "seen" ? s.ringSeen : null]}>
      <View style={s.ringGap}>
        <Avatar user={user} size={58} />
      </View>
    </View>
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
      backgroundColor: "#ff3040",
      borderWidth: 1.5,
      borderColor: t.colors.bg,
    },
    peopleRow: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.colors.border,
    },
    people: { paddingHorizontal: 12, paddingTop: 6, paddingBottom: 12, gap: 14 },
    person: { alignItems: "center", gap: 6, minWidth: 70 },
    brand: { flexDirection: "row", alignItems: "center", gap: 6, paddingLeft: 12 },
    topRight: { flexDirection: "row", alignItems: "center" },
    disc: {
      position: "absolute",
      right: -2,
      bottom: -2,
      width: 26,
      height: 26,
      borderRadius: 13,
      borderWidth: 2.5,
      borderColor: t.colors.bg,
      overflow: "hidden",
      backgroundColor: t.colors.surfaceRaised,
    },
    discImage: { width: "100%", height: "100%" },
    ring: { width: 68, height: 68, borderRadius: 34, padding: 2.5 },
    ringSeen: { borderWidth: 1.5, borderColor: t.colors.borderStrong, padding: 1 },
    ringGap: {
      flex: 1,
      borderRadius: 32,
      padding: 2.5,
      backgroundColor: t.colors.bg,
      alignItems: "center",
      justifyContent: "center",
    },
    thin: { borderRadius: 34, borderWidth: 1.5, borderColor: "transparent", padding: 3 },
    thinNew: { borderWidth: 2, borderColor: t.colors.text },
    thinSeen: { borderColor: t.colors.borderStrong },
    band: {
      width: 84,
      height: 118,
      borderRadius: t.radius.card,
      overflow: "hidden",
      backgroundColor: t.colors.surfaceRaised,
    },
    bandNew: { borderWidth: 2.5, borderColor: t.colors.accent },
    bandNone: { opacity: 0.8 },
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
    bandNameNone: { color: t.colors.textSoft },
    personName: {
      fontFamily: t.fonts.body,
      fontSize: 12.5 * t.textScale,
      color: t.colors.textSoft,
      maxWidth: 70,
    },
    personNew: { color: t.colors.text, fontFamily: t.fonts.bold },
    plus: {
      position: "absolute",
      right: 0,
      top: 46,
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: t.colors.text,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 3,
      borderColor: t.colors.bg,
    },
    plusBand: { top: 92, right: -4 },
  });
