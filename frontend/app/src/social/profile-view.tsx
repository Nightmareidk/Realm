import type { Channel, FollowState, Post, Profile } from "@realm/contracts";
import { FlashList } from "@shopify/flash-list";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useRouter } from "expo-router";
import { type ReactNode, useCallback, useState } from "react";
import {
  Linking,
  Pressable,
  Share,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { alert } from "../alert";
import { useApi, usePosts } from "../data";
import { Icon } from "../icon";
import { useLiveEvent } from "../live";
import { ApiError, api, mediaSource } from "../server";
import { useSheet } from "../sheet";
import { type NativeTheme, useStyles, useTheme } from "../theme";
import { Pill } from "../ui";
import { Avatar, fillFor } from "./avatar";
import { useSafety } from "./safety";
import { Empty, Loading, Problem } from "./screen";
import { compact } from "./time";

type Tab = "posts" | "clips" | "saved";

/**
 * A profile (yours on the You tab, anyone's from a name): banner, picture, name, counts, follow
 * or edit, then the grid of Posts, Clips and (yours only) Saved.
 */
export function ProfileView({ username, top }: { username: string; top: ReactNode }) {
  const { t } = useTheme();
  const theme = t;
  const s = useStyles(make);
  const router = useRouter();
  const { data: profile, setData, error, reload } = useApi<Profile>(`/users/${username}/profile`);
  const [tab, setTab] = useState<Tab>("posts");
  const path =
    tab === "saved"
      ? "/users/@me/saved"
      : `/users/${username}/posts${tab === "clips" ? "?kind=clip" : ""}`;
  const list = usePosts(profile ? path : null);
  const sheet = useSheet();
  const safety = useSafety();
  // Fresh each time you come back to it, and live while it's open: follower counts change as
  // people follow and unfollow.
  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );
  useLiveEvent("PROFILE_COUNTS", (d) => {
    if (!profile || d.userId !== profile.user.id) return;
    setData({
      ...profile,
      counts: { ...profile.counts, followers: d.followers, following: d.following },
    });
  });

  if (error && !profile) return <Problem message={error} onRetry={reload} />;
  if (!profile) return <Loading />;

  async function follow(next: "follow" | "unfollow") {
    if (!profile) return;
    const was = profile;
    try {
      const res = await api<{ follow: FollowState }>(`/users/${username}/follow`, {
        method: next === "follow" ? "PUT" : "DELETE",
      });
      const followers =
        profile.counts.followers +
        (res.follow === "following" && profile.follow !== "following" ? 1 : 0) -
        (res.follow !== "following" && profile.follow === "following" ? 1 : 0);
      setData({
        ...profile,
        follow: res.follow,
        counts: { ...profile.counts, followers },
        canSeeAll: profile.isSelf || !profile.isPrivate || res.follow === "following",
      });
      list.refresh();
    } catch (err) {
      setData(was);
      alert("That didn't work", err instanceof ApiError ? err.message : "Try again.");
    }
  }

  async function message() {
    if (!profile) return;
    try {
      const dm = await api<Channel>("/users/@me/channels", {
        body: { recipientIds: [profile.user.id] },
      });
      router.push({ pathname: "/chat/[id]", params: { id: dm.id } });
    } catch (err) {
      alert("Can't message them", err instanceof ApiError ? err.message : "Try again.");
    }
  }

  /** Someone else's profile menu: report, block, or stop them following you. */
  function more() {
    if (!profile) return;
    const them = profile.user;
    const summary = {
      id: them.id,
      username: them.username,
      displayName: them.displayName,
      avatarUrl: them.avatarUrl,
      accentColor: them.accentColor,
    };
    sheet({
      title: them.displayName,
      actions: [
        ...(profile.followsYou
          ? [
              {
                label: "Remove follower",
                icon: "UserMinus" as const,
                onPress: () =>
                  sheet({
                    title: `Remove ${them.displayName} as a follower?`,
                    line: profile.isPrivate
                      ? "They'll stop seeing your followers-only posts, and would have to ask again. They aren't told."
                      : "They'll stop seeing your posts on their Home. They aren't told.",
                    actions: [
                      {
                        label: "Remove",
                        danger: true,
                        onPress: async () => {
                          try {
                            await api(`/users/@me/followers/${them.username}`, {
                              method: "DELETE",
                            });
                            reload();
                          } catch (err) {
                            sheet({
                              title: "Not removed",
                              line: err instanceof ApiError ? err.message : "Try again.",
                              actions: [],
                            });
                          }
                        },
                      },
                    ],
                  }),
              },
            ]
          : []),
        {
          label: "Report account",
          icon: "Flag",
          danger: true,
          onPress: () => safety.report("user", them.id, summary),
        },
        {
          label: `Block @${them.username}`,
          icon: "Prohibit",
          danger: true,
          onPress: () =>
            safety.block(summary, () =>
              router.canGoBack() ? router.back() : router.replace("/home"),
            ),
        },
      ],
    });
  }

  const tabs: Tab[] = profile.isSelf ? ["posts", "clips", "saved"] : ["posts", "clips"];

  const header = (
    <View>
      {top}
      <Banner profile={profile} />
      <View style={s.body}>
        <View style={s.picRow}>
          <View style={s.pic}>
            <Avatar user={profile.user} size={88} />
          </View>
        </View>
        <Text style={s.name} accessibilityRole="header">
          {profile.user.displayName}
        </Text>
        <Text style={s.handle}>
          @{profile.user.username}
          {profile.user.pronouns ? ` · ${profile.user.pronouns}` : ""}
        </Text>
        {profile.accountKind === "business" && profile.category ? (
          <View style={s.category}>
            <Icon name="Briefcase" size={14} color={t.colors.textSoft} />
            <Text style={s.categoryText}>{profile.category}</Text>
          </View>
        ) : null}
        {profile.user.bio ? <Text style={s.bio}>{profile.user.bio}</Text> : null}
        {profile.websiteUrl ? (
          <Pressable
            accessibilityRole="link"
            onPress={() => Linking.openURL(profile.websiteUrl as string)}
            style={s.site}
          >
            <Icon name="Link" size={15} color={t.colors.text} />
            <Text style={s.siteText} numberOfLines={1}>
              {profile.websiteUrl.replace(/^https?:\/\//, "")}
            </Text>
          </Pressable>
        ) : null}

        <View style={s.counts}>
          <Count n={profile.counts.posts} label="posts" />
          <Count
            n={profile.counts.followers}
            label="followers"
            onPress={
              profile.canSeeAll
                ? () =>
                    router.push({
                      pathname: "/people/[username]",
                      params: { username, side: "followers" },
                    })
                : undefined
            }
          />
          <Count
            n={profile.counts.following}
            label="following"
            onPress={
              profile.canSeeAll
                ? () =>
                    router.push({
                      pathname: "/people/[username]",
                      params: { username, side: "following" },
                    })
                : undefined
            }
          />
        </View>

        <View style={s.actions}>
          {profile.isSelf ? (
            <>
              <Pill
                size="md"
                kind="ghost"
                label="Edit profile"
                onPress={() => router.push("/edit-profile")}
                style={s.grow}
              />
              <Pill
                size="md"
                kind="ghost"
                label="Share profile"
                onPress={() => Share.share({ message: `@${profile.user.username} on Realm` })}
                style={s.grow}
              />
            </>
          ) : (
            <>
              {profile.follow === "none" ? (
                <Pill
                  size="md"
                  label={profile.followsYou ? "Follow back" : "Follow"}
                  onPress={() => follow("follow")}
                  style={s.grow}
                />
              ) : (
                <Pill
                  size="md"
                  kind="ghost"
                  label={profile.follow === "requested" ? "Requested" : "Following"}
                  onPress={() =>
                    alert(
                      profile.follow === "requested"
                        ? "Cancel your request?"
                        : `Unfollow ${profile.user.displayName}?`,
                      profile.isPrivate && profile.follow === "following"
                        ? "Their account is private, so you'd have to ask again to see their posts."
                        : undefined,
                      [
                        { text: "Keep", style: "cancel" },
                        {
                          text: profile.follow === "requested" ? "Cancel request" : "Unfollow",
                          style: "destructive",
                          onPress: () => follow("unfollow"),
                        },
                      ],
                    )
                  }
                  style={s.grow}
                />
              )}
              <Pill size="md" kind="ghost" label="Message" onPress={message} style={s.grow} />
              <Pressable
                onPress={more}
                accessibilityRole="button"
                accessibilityLabel={`More about ${profile.user.displayName}`}
                style={({ pressed }) => [
                  s.more,
                  pressed && { backgroundColor: t.colors.surfaceRaised },
                ]}
              >
                <Icon name="DotsThreeBold" size={20} color={t.colors.text} />
              </Pressable>
            </>
          )}
        </View>

        {!profile.canSeeAll ? (
          <View style={s.private}>
            <Icon name="Lock" size={22} color={t.colors.text} />
            <View style={s.grow}>
              <Text style={s.privateTitle}>This account is private</Text>
              <Text style={s.privateLine}>
                Follow to see their posts. Anything they've made public still shows below.
              </Text>
            </View>
          </View>
        ) : null}
      </View>

      <View style={s.tabs} accessibilityRole="tablist">
        {tabs.map((t) => (
          <Pressable
            key={t}
            onPress={() => setTab(t)}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === t }}
            style={[s.tab, tab === t && s.tabOn]}
          >
            <Icon
              name={
                t === "posts"
                  ? tab === t
                    ? "GridFourFill"
                    : "GridFour"
                  : t === "clips"
                    ? "PlayFill"
                    : tab === t
                      ? "BookmarkSimpleFill"
                      : "BookmarkSimple"
              }
              size={18}
              color={tab === t ? theme.colors.text : theme.colors.textSoft}
            />
            <Text style={[s.tabText, tab === t && s.tabTextOn]}>
              {t === "posts" ? "Posts" : t === "clips" ? "Clips" : "Saved"}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );

  return (
    <FlashList
      data={list.items}
      numColumns={3}
      keyExtractor={(p) => p.id}
      renderItem={({ item }) => <Tile post={item} />}
      ListHeaderComponent={header}
      ListEmptyComponent={
        list.loading ? (
          <Loading />
        ) : (
          <Empty
            title={
              tab === "saved"
                ? "Nothing saved yet"
                : tab === "clips"
                  ? "No Clips yet"
                  : "No posts yet"
            }
            line={
              tab === "saved"
                ? "Tap the bookmark on a post to keep it here. Only you can see what you save."
                : profile.isSelf
                  ? "Share your first one with the + on Home."
                  : undefined
            }
          />
        )
      }
      onEndReached={list.more}
      refreshing={list.refreshing && !list.loading}
      onRefresh={() => {
        reload();
        list.refresh();
      }}
    />
  );
}

function Banner({ profile }: { profile: Profile }) {
  const { t } = useTheme();
  const s = useStyles(make);
  const fill = fillFor(profile.user.id);
  return (
    <View style={s.banner}>
      {profile.user.bannerUrl ? (
        <Image
          source={mediaSource(profile.user.bannerUrl)}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
        />
      ) : (
        <LinearGradient
          colors={[fill, "#2b47ff", t.colors.bg]}
          locations={[0, 0.55, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      )}
      <LinearGradient
        colors={["rgba(11,11,14,0)", "rgba(11,11,14,0.7)"]}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}

function Count({ n, label, onPress }: { n: number; label: string; onPress?: () => void }) {
  const s = useStyles(make);
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? "link" : "text"}
      accessibilityLabel={`${n} ${label}`}
      style={s.count}
    >
      <Text style={s.countN}>{compact(n)}</Text>
      <Text style={s.countLabel}>{label}</Text>
    </Pressable>
  );
}

/** A square in the grid: the first photo, a Clip's play mark, or a text post's opening words. */
function Tile({ post }: { post: Post }) {
  const s = useStyles(make);
  const router = useRouter();
  const { width } = useWindowDimensions();
  const size = (width - 4) / 3;
  const first = post.media[0];
  return (
    <Pressable
      onPress={() => router.push({ pathname: "/post/[id]", params: { id: post.id } })}
      accessibilityRole="link"
      accessibilityLabel={
        post.kind === "clip" ? "Clip" : post.kind === "text" ? (post.caption ?? "Post") : "Photo"
      }
      style={[s.tile, { width: size, height: size * 1.25 }]}
    >
      {post.kind === "image" && first ? (
        <Image
          source={mediaSource(first.url)}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          recyclingKey={first.id}
        />
      ) : post.kind === "text" ? (
        <Text style={s.tileText} numberOfLines={6}>
          {post.caption}
        </Text>
      ) : null}
      {post.kind === "clip" ? (
        <View style={s.tileMark}>
          <Icon name="PlayFill" size={16} color="#ffffff" />
        </View>
      ) : post.media.length > 1 ? (
        <View style={s.tileMark}>
          <Icon name="GridFourFill" size={14} color="#ffffff" />
        </View>
      ) : null}
    </Pressable>
  );
}

const make = (t: NativeTheme) =>
  StyleSheet.create({
    banner: { height: 132 },
    body: { paddingHorizontal: 16, marginTop: -48 },
    picRow: { flexDirection: "row", alignItems: "flex-end" },
    pic: { borderRadius: 48, borderWidth: 4, borderColor: t.colors.bg },
    name: {
      fontFamily: t.fonts.displayBold,
      fontSize: 24 * t.textScale,
      color: t.colors.text,
      marginTop: 10,
      letterSpacing: -0.4,
    },
    handle: {
      fontFamily: t.fonts.body,
      fontSize: 15 * t.textScale,
      color: t.colors.textSoft,
      marginTop: 2,
    },
    category: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      alignSelf: "flex-start",
      marginTop: 8,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 999,
      backgroundColor: "rgba(11,11,14,0.65)",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: "rgba(255,255,255,0.14)",
    },
    categoryText: {
      fontFamily: t.fonts.bold,
      fontSize: 13 * t.textScale,
      color: t.colors.textSoft,
    },
    bio: {
      fontFamily: t.fonts.body,
      fontSize: 15.5 * t.textScale,
      lineHeight: 23 * t.textScale,
      color: t.colors.text,
      marginTop: 10,
    },
    site: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 40 },
    siteText: {
      fontFamily: t.fonts.bold,
      fontSize: 15 * t.textScale,
      color: t.colors.text,
      textDecorationLine: "underline",
    },
    counts: { flexDirection: "row", gap: 24, marginTop: 12 },
    count: { minHeight: 48, justifyContent: "center" },
    countN: { fontFamily: t.fonts.bold, fontSize: 17 * t.textScale, color: t.colors.text },
    countLabel: {
      fontFamily: t.fonts.body,
      fontSize: 13.5 * t.textScale,
      color: t.colors.textSoft,
    },
    actions: { flexDirection: "row", gap: 8, marginTop: 10 },
    more: {
      width: 44,
      height: 44,
      borderRadius: 22,
      borderWidth: 1.5,
      borderColor: t.colors.borderStrong,
      alignItems: "center",
      justifyContent: "center",
    },
    grow: { flex: 1 },
    private: {
      flexDirection: "row",
      gap: 12,
      alignItems: "flex-start",
      marginTop: 18,
      paddingVertical: 14,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: t.colors.border,
    },
    privateTitle: { fontFamily: t.fonts.bold, fontSize: 16 * t.textScale, color: t.colors.text },
    privateLine: {
      fontFamily: t.fonts.body,
      fontSize: 14.5 * t.textScale,
      lineHeight: 21 * t.textScale,
      color: t.colors.textSoft,
      marginTop: 2,
    },
    tabs: {
      flexDirection: "row",
      marginTop: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.colors.border,
    },
    tab: {
      flex: 1,
      flexDirection: "row",
      gap: 6,
      alignItems: "center",
      justifyContent: "center",
      minHeight: 48,
    },
    tabOn: { borderBottomWidth: 2, borderBottomColor: t.colors.text },
    tabText: { fontFamily: t.fonts.bold, fontSize: 14 * t.textScale, color: t.colors.textSoft },
    tabTextOn: { color: t.colors.text },
    tile: {
      margin: 0.66,
      backgroundColor: t.colors.surfaceSunken,
      overflow: "hidden",
      justifyContent: "center",
    },
    tileText: {
      fontFamily: t.fonts.body,
      fontSize: 13 * t.textScale,
      lineHeight: 18 * t.textScale,
      color: t.colors.text,
      padding: 10,
    },
    tileMark: { position: "absolute", top: 6, right: 6 },
  });
