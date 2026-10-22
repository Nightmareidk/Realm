import type { Activity, ActivityPage, FollowRequest } from "@realm/contracts";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useEffect } from "react";
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useApi } from "@/data";
import { ApiError, api, mediaSource } from "@/server";
import { Avatar } from "@/social/avatar";
import { PersonRow } from "@/social/person-row";
import { AppScreen, Empty, Loading, Problem, TopBar } from "@/social/screen";
import { ago } from "@/social/time";
import { type NativeTheme, useStyles } from "@/theme";
import { Pill } from "@/ui";

/** The heart on Home: follow requests first, then likes, comments and follows. */
export default function ActivityScreen() {
  const s = useStyles(make);
  const feed = useApi<ActivityPage>("/users/@me/activity");
  const requests = useApi<FollowRequest[]>("/users/@me/follow-requests");

  useEffect(() => {
    if (feed.data?.unread) api("/users/@me/activity/read", { method: "POST" }).catch(() => {});
  }, [feed.data?.unread]);

  async function respond(r: FollowRequest, accept: boolean) {
    try {
      await api(`/users/@me/follow-requests/${r.user.username}`, {
        method: accept ? "POST" : "DELETE",
      });
      requests.setData((requests.data ?? []).filter((x) => x.user.id !== r.user.id));
    } catch (err) {
      Alert.alert("That didn't work", err instanceof ApiError ? err.message : "Try again.");
    }
  }

  const header = requests.data?.length ? (
    <View style={s.section}>
      <Text style={s.heading}>Follow requests</Text>
      {requests.data.map((r) => (
        <PersonRow
          key={r.user.id}
          user={r.user}
          line={`Asked ${ago(r.createdAt)} ago`.replace("now ago", "just now")}
          right={
            <View style={s.reqActions}>
              <Pill size="md" label="Confirm" onPress={() => respond(r, true)} />
              <Pill size="md" kind="ghost" label="Delete" onPress={() => respond(r, false)} />
            </View>
          }
        />
      ))}
    </View>
  ) : null;

  return (
    <AppScreen>
      <TopBar title="Activity" />
      {feed.error && !feed.data ? (
        <Problem message={feed.error} onRetry={feed.reload} />
      ) : !feed.data ? (
        <Loading />
      ) : (
        <FlatList
          data={feed.data.items}
          keyExtractor={(a) => a.id}
          ListHeaderComponent={header}
          renderItem={({ item }) => <Row item={item} />}
          ListEmptyComponent={
            requests.data?.length ? null : (
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
        />
      )}
    </AppScreen>
  );
}

function sentence(a: Activity) {
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

function Row({ item }: { item: Activity }) {
  const s = useStyles(make);
  const router = useRouter();
  const open = () => {
    if (item.post) router.push({ pathname: "/post/[id]", params: { id: item.post.id } });
    else if (item.actor) {
      router.push({ pathname: "/user/[username]", params: { username: item.actor.username } });
    }
  };
  return (
    <Pressable onPress={open} accessibilityRole="link" style={[s.row, !item.read && s.unread]}>
      {item.actor ? <Avatar user={item.actor} size={44} /> : null}
      <Text style={s.text} numberOfLines={3}>
        <Text style={s.name}>{item.actor?.displayName ?? "Someone"} </Text>
        {sentence(item)} <Text style={s.when}>{ago(item.createdAt)}</Text>
      </Text>
      {item.post?.thumbUrl ? (
        <Image source={mediaSource(item.post.thumbUrl)} style={s.thumb} contentFit="cover" />
      ) : null}
    </Pressable>
  );
}

const make = (t: NativeTheme) =>
  StyleSheet.create({
    section: {
      paddingTop: 6,
      paddingBottom: 6,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.colors.border,
    },
    heading: {
      fontFamily: t.fonts.bold,
      fontSize: 15 * t.textScale,
      color: t.colors.text,
      paddingHorizontal: 16,
      paddingTop: 10,
      paddingBottom: 4,
    },
    reqActions: { flexDirection: "row", gap: 6 },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingHorizontal: 16,
      paddingVertical: 10,
      minHeight: 64,
    },
    unread: { backgroundColor: "rgba(255,255,255,0.03)" },
    text: {
      flex: 1,
      fontFamily: t.fonts.body,
      fontSize: 15 * t.textScale,
      lineHeight: 21 * t.textScale,
      color: t.colors.text,
    },
    name: { fontFamily: t.fonts.bold },
    when: { color: t.colors.textSoft, fontSize: 13.5 * t.textScale },
    thumb: { width: 44, height: 55, borderRadius: 6, backgroundColor: t.colors.surfaceSunken },
  });
