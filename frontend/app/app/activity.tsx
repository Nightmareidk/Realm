import type { Activity, ActivityPage, FollowRequest, FollowState } from "@realm/contracts";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Pressable, SectionList, StyleSheet, Text, View } from "react-native";
import { alert } from "@/alert";
import { useApi } from "@/data";
import { Icon } from "@/icon";
import type { IconName } from "@/icon-paths";
import { ApiError, api, mediaSource } from "@/server";
import { Avatar } from "@/social/avatar";
import { GlowTop } from "@/social/glow-top";
import { LIKED } from "@/social/post-card";
import { AppScreen, Empty, Loading, Problem, TopBar } from "@/social/screen";
import { ago } from "@/social/time";
import { type NativeTheme, useStyles, useTheme } from "@/theme";
import { Pill } from "@/ui";

/** Likes on the same post, close together, read as one line ("Aras, Mei and 3 others"). */
interface Line {
  key: string;
  first: Activity;
  people: NonNullable<Activity["actor"]>[];
}

const SECTIONS = ["New", "Today", "This week", "This month", "Earlier"] as const;

function sectionOf(a: Activity, now: number): (typeof SECTIONS)[number] {
  if (!a.read) return "New";
  const days = (now - Date.parse(a.createdAt)) / 86_400_000;
  if (days < 1) return "Today";
  if (days < 7) return "This week";
  if (days < 30) return "This month";
  return "Earlier";
}

/** Group a section's items: likes on one post become one line. */
function lines(items: Activity[]): Line[] {
  const out: Line[] = [];
  for (const a of items) {
    const prev = out.at(-1);
    if (
      prev &&
      a.type === "post_like" &&
      prev.first.type === "post_like" &&
      prev.first.post?.id === a.post?.id
    ) {
      if (a.actor && !prev.people.some((p) => p.id === a.actor?.id)) prev.people.push(a.actor);
      continue;
    }
    out.push({ key: a.id, first: a, people: a.actor ? [a.actor] : [] });
  }
  return out;
}

/**
 * Activity (the heart on Home), the way people know it from Instagram: follow requests waiting
 * at the top, then what's new, today, this week and earlier. Likes on one post read as one line;
 * a new follower has a Follow back button; a comment can be answered straight away.
 */
export default function ActivityScreen() {
  const s = useStyles(make);
  const feed = useApi<ActivityPage>("/users/@me/activity");
  const requests = useApi<FollowRequest[]>("/users/@me/follow-requests");
  // Who you've followed back from here, so the button changes at once.
  const [followed, setFollowed] = useState<Record<string, FollowState>>({});

  useEffect(() => {
    if (feed.data?.unread) api("/users/@me/activity/read", { method: "POST" }).catch(() => {});
  }, [feed.data?.unread]);

  const sections = useMemo(() => {
    const now = Date.now();
    const items = (feed.data?.items ?? []).filter((a) => a.type !== "follow_request");
    return SECTIONS.map((title) => ({
      title,
      data: lines(items.filter((a) => sectionOf(a, now) === title)),
    })).filter((sec) => sec.data.length > 0);
  }, [feed.data]);

  async function followBack(username: string, id: string) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setFollowed((f) => ({ ...f, [id]: "following" }));
    try {
      const res = await api<{ follow: FollowState }>(`/users/${username}/follow`, {
        method: "PUT",
      });
      setFollowed((f) => ({ ...f, [id]: res.follow }));
    } catch (err) {
      setFollowed(({ [id]: _, ...rest }) => rest);
      alert("That didn't work", err instanceof ApiError ? err.message : "Try again.");
    }
  }

  const waiting = requests.data ?? [];
  const header = waiting.length ? <RequestsRow waiting={waiting} /> : null;

  // The newest post someone reacted to lights the top (Look B); otherwise the theme's own light.
  const lit = feed.data?.items.find((a) => a.post?.thumbUrl)?.post?.thumbUrl ?? null;

  return (
    <AppScreen>
      <GlowTop picture={lit} />
      <TopBar title="Activity" />
      {feed.error && !feed.data ? (
        <Problem message={feed.error} onRetry={feed.reload} />
      ) : !feed.data ? (
        <Loading />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(l) => l.key}
          ListHeaderComponent={header}
          stickySectionHeadersEnabled={false}
          renderSectionHeader={({ section }) => (
            <Text style={s.heading} accessibilityRole="header">
              {section.title}
            </Text>
          )}
          renderItem={({ item }) => (
            <Row
              line={item}
              standing={
                item.first.actor
                  ? (followed[item.first.actor.id] ?? item.first.youFollow)
                  : item.first.youFollow
              }
              onFollowBack={followBack}
            />
          )}
          ListEmptyComponent={
            waiting.length ? null : (
              <Empty
                title="Nothing here yet"
                line="When people like or comment on your posts, or follow you, you'll see it here."
              />
            )
          }
          onRefresh={() => {
            feed.reload();
            requests.reload();
          }}
          refreshing={false}
          contentContainerStyle={s.list}
        />
      )}
    </AppScreen>
  );
}

/** "Follow requests: Noor and 4 others", opening the full list. */
function RequestsRow({ waiting }: { waiting: FollowRequest[] }) {
  const { t } = useTheme();
  const s = useStyles(make);
  const router = useRouter();
  const [a, b] = waiting;
  const others = waiting.length - 1;
  return (
    <Pressable
      onPress={() => router.push("/follow-requests")}
      accessibilityRole="link"
      accessibilityLabel={`Follow requests, ${waiting.length}`}
      style={({ pressed }) => [s.requests, pressed && s.pressed]}
    >
      <View style={s.stack}>
        {b ? (
          <View style={s.stackBack}>
            <Avatar user={b.user} size={36} />
          </View>
        ) : null}
        {a ? (
          <View style={[s.stackFront, !b && s.stackAlone]}>
            <Avatar user={a.user} size={b ? 36 : 46} />
          </View>
        ) : null}
      </View>
      <View style={s.fill}>
        <Text style={s.requestsTitle}>Follow requests</Text>
        <Text style={s.requestsLine} numberOfLines={1}>
          {a?.user.displayName}
          {others > 0 ? ` and ${others} ${others === 1 ? "other" : "others"}` : ""}
        </Text>
      </View>
      <View style={s.redDot}>
        <Text style={s.redDotText}>{waiting.length > 99 ? "99+" : waiting.length}</Text>
      </View>
      <Icon name="CaretRight" size={18} color={t.colors.textSoft} />
    </Pressable>
  );
}

const BADGE: Partial<Record<Activity["type"], { icon: IconName; bg: string }>> = {
  post_like: { icon: "HeartFill", bg: LIKED },
  post_comment: { icon: "ChatCircleFill", bg: "#5b8cff" },
  comment_reply: { icon: "ChatCircleFill", bg: "#5b8cff" },
  follow: { icon: "UserPlus", bg: "#8a63ff" },
};

function sentence(l: Line) {
  const a = l.first;
  switch (a.type) {
    case "follow":
      return a.accepted ? "accepted your follow request." : "started following you.";
    case "follow_request":
      return "asked to follow you.";
    case "post_like":
      return "liked your post.";
    case "post_comment":
      return a.text ? `commented: ${a.text}` : "commented on your post.";
    case "comment_reply":
      return a.text ? `replied: ${a.text}` : "replied to your comment.";
  }
}

function names(l: Line) {
  const [one, two] = l.people;
  const rest = l.people.length - 2;
  if (!one) return "Someone";
  if (!two) return one.username;
  if (rest <= 0) return `${one.username} and ${two.username}`;
  return `${one.username}, ${two.username} and ${rest} ${rest === 1 ? "other" : "others"}`;
}

function Row({
  line,
  standing,
  onFollowBack,
}: {
  line: Line;
  standing: FollowState;
  onFollowBack: (username: string, id: string) => void;
}) {
  const { t } = useTheme();
  const s = useStyles(make);
  const router = useRouter();
  const item = line.first;
  const [one, two] = line.people;
  const badge = BADGE[item.type];
  const openPost = () =>
    item.post && router.push({ pathname: "/post/[id]", params: { id: item.post.id } });
  const openPerson = (username: string) =>
    router.push({ pathname: "/user/[username]", params: { username } });
  const open = () => (item.post ? openPost() : one ? openPerson(one.username) : undefined);
  const isFollow = item.type === "follow" && !item.accepted;

  return (
    <Pressable
      onPress={open}
      accessibilityRole="link"
      accessibilityLabel={`${names(line)} ${sentence(line)} ${ago(item.createdAt)}`}
      style={({ pressed }) => [s.row, pressed && s.pressed]}
    >
      <Pressable
        onPress={() => one && openPerson(one.username)}
        accessibilityRole="link"
        accessibilityLabel={one?.displayName ?? "Someone"}
        style={s.faces}
      >
        {two ? (
          <>
            <View style={s.stackBack}>
              <Avatar user={two} size={34} />
            </View>
            <View style={s.stackFront}>{one ? <Avatar user={one} size={34} /> : null}</View>
          </>
        ) : one ? (
          <Avatar user={one} size={46} />
        ) : null}
        {badge ? (
          <View style={[s.badge, { backgroundColor: badge.bg }]}>
            <Icon name={badge.icon} size={11} color="#ffffff" />
          </View>
        ) : null}
      </Pressable>
      <View style={s.fill}>
        <Text style={s.text} numberOfLines={4}>
          <Text style={s.name}>{names(line)} </Text>
          {sentence(line)} <Text style={s.when}>{ago(item.createdAt)}</Text>
        </Text>
        {item.type === "post_comment" || item.type === "comment_reply" ? (
          <Pressable onPress={openPost} accessibilityRole="button" hitSlop={6}>
            <Text style={s.reply}>Reply</Text>
          </Pressable>
        ) : null}
      </View>
      {isFollow && one ? (
        standing === "none" ? (
          <Pill size="sm" label="Follow back" onPress={() => onFollowBack(one.username, one.id)} />
        ) : (
          <Pill
            size="sm"
            kind="ghost"
            label={standing === "requested" ? "Requested" : "Following"}
            onPress={() => openPerson(one.username)}
          />
        )
      ) : item.post?.thumbUrl ? (
        <Image
          source={mediaSource(item.post.thumbUrl)}
          style={s.thumb}
          contentFit="cover"
          recyclingKey={item.post.thumbUrl}
        />
      ) : item.post ? (
        <View style={[s.thumb, s.thumbText]}>
          <Icon name="Article" size={18} color={t.colors.textSoft} />
        </View>
      ) : null}
    </Pressable>
  );
}

const make = (t: NativeTheme) =>
  StyleSheet.create({
    fill: { flex: 1 },
    list: { paddingBottom: 40 },
    pressed: { backgroundColor: t.colors.surface },
    heading: {
      fontFamily: t.fonts.displayBold,
      fontSize: 17 * t.textScale,
      color: t.colors.heading,
      paddingHorizontal: 16,
      paddingTop: 18,
      paddingBottom: 6,
    },
    requests: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.colors.border,
    },
    requestsTitle: { fontFamily: t.fonts.bold, fontSize: 15.5 * t.textScale, color: t.colors.text },
    requestsLine: {
      fontFamily: t.fonts.body,
      fontSize: 14 * t.textScale,
      color: t.colors.textSoft,
      marginTop: 1,
    },
    redDot: {
      minWidth: 22,
      height: 22,
      borderRadius: 11,
      paddingHorizontal: 6,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "#ff3040",
    },
    redDotText: { fontFamily: t.fonts.bold, fontSize: 12 * t.textScale, color: "#ffffff" },
    stack: { width: 50, height: 50 },
    faces: { width: 50, height: 50 },
    stackBack: { position: "absolute", top: 0, left: 0 },
    stackFront: {
      position: "absolute",
      right: 0,
      bottom: 0,
      borderRadius: 20,
      borderWidth: 2,
      borderColor: t.colors.bg,
    },
    stackAlone: { right: 2, bottom: 2, borderWidth: 0 },
    badge: {
      position: "absolute",
      right: -2,
      bottom: -2,
      width: 20,
      height: 20,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 2,
      borderColor: t.colors.bg,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingHorizontal: 16,
      paddingVertical: 9,
      minHeight: 66,
    },
    text: {
      fontFamily: t.fonts.body,
      fontSize: 14.5 * t.textScale,
      lineHeight: 20 * t.textScale,
      color: t.colors.text,
    },
    name: { fontFamily: t.fonts.bold },
    when: { color: t.colors.textSoft, fontSize: 13.5 * t.textScale },
    reply: {
      fontFamily: t.fonts.bold,
      fontSize: 13 * t.textScale,
      color: t.colors.textSoft,
      marginTop: 4,
    },
    thumb: {
      width: 46,
      height: 46,
      borderRadius: Math.min(8, t.radius.box),
      backgroundColor: t.colors.surfaceSunken,
    },
    thumbText: { alignItems: "center", justifyContent: "center" },
  });
