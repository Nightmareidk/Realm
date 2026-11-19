import type { Post, QuotedPost } from "@realm/contracts";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Icon } from "../icon";
import { mediaSource } from "../server";
import { type NativeTheme, useStyles, useTheme } from "../theme";
import { Avatar } from "./avatar";
import { ago } from "./time";
import { Verified } from "./verified";

/** A post as the thing a quote post is about (what the composer shows before it exists). */
export const asQuoted = (post: Post): QuotedPost => ({
  id: post.id,
  post: {
    author: post.author,
    kind: post.kind,
    caption: post.caption,
    media: post.media[0] ?? null,
    hasPoll: post.poll !== null,
    createdAt: post.createdAt,
  },
});

/**
 * The post a quote is about, small, under the quote's own words: who, when, what they said and
 * its first picture. Tapping opens it. When it's gone (deleted, made private, or its author and
 * you blocked each other) it says so and opens nothing.
 */
export function QuotedCard({ quoted, still = false }: { quoted: QuotedPost; still?: boolean }) {
  const { t } = useTheme();
  const s = useStyles(make);
  const router = useRouter();
  const q = quoted.post;
  if (!q) {
    return (
      <View
        style={[s.card, s.gone]}
        accessible
        accessibilityLabel="The quoted post isn't available"
      >
        <Icon name="EyeSlash" size={16} color={t.colors.textSoft} />
        <Text style={s.goneText}>This post isn't available any more.</Text>
      </View>
    );
  }
  return (
    <Pressable
      onPress={() => router.push({ pathname: "/post/[id]", params: { id: quoted.id } })}
      disabled={still}
      accessibilityRole="link"
      accessibilityLabel={`Quoted post by ${q.author.displayName}${q.caption ? `: ${q.caption.slice(0, 120)}` : ""}`}
      style={({ pressed }) => [s.card, pressed && s.pressed]}
    >
      <View style={s.text}>
        <View style={s.who}>
          <Avatar user={q.author} size={20} />
          <Text style={s.name} numberOfLines={1}>
            {q.author.displayName}
          </Text>
          <Verified kind={q.author.verified} size={13} />
          <Text style={s.when}>· {ago(q.createdAt)}</Text>
        </View>
        {q.caption ? (
          <Text style={s.caption} numberOfLines={q.media ? 3 : 5}>
            {q.caption}
          </Text>
        ) : null}
        {q.hasPoll || q.kind === "clip" ? (
          <View style={s.kind}>
            <Icon
              name={q.hasPoll ? "ChartBarHorizontal" : "PlayFill"}
              size={14}
              color={t.colors.textSoft}
            />
            <Text style={s.kindText}>{q.hasPoll ? "Poll" : "Clip"}</Text>
          </View>
        ) : null}
      </View>
      {q.media && q.media.kind !== "video" ? (
        <Image
          source={mediaSource(q.media.url)}
          style={s.thumb}
          contentFit="cover"
          transition={150}
          recyclingKey={`quoted-${q.media.id}`}
          accessible={false}
        />
      ) : null}
    </Pressable>
  );
}

const make = (t: NativeTheme) =>
  StyleSheet.create({
    card: {
      flexDirection: "row",
      gap: 12,
      marginHorizontal: 14,
      marginTop: 6,
      marginBottom: 4,
      padding: 12,
      borderRadius: t.radius.box,
      borderWidth: 1.5,
      borderColor: t.colors.border,
      backgroundColor: t.colors.surface,
    },
    pressed: { backgroundColor: t.colors.surfaceRaised },
    gone: { alignItems: "center", gap: 8 },
    goneText: {
      flex: 1,
      fontFamily: t.fonts.body,
      fontSize: 14 * t.textScale,
      color: t.colors.textSoft,
    },
    text: { flex: 1, gap: 6 },
    who: { flexDirection: "row", alignItems: "center", gap: 6 },
    name: {
      flexShrink: 1,
      fontFamily: t.fonts.bold,
      fontSize: 14 * t.textScale,
      color: t.colors.text,
    },
    when: { fontFamily: t.fonts.body, fontSize: 13 * t.textScale, color: t.colors.textSoft },
    caption: {
      fontFamily: t.fonts.body,
      fontSize: 15 * t.textScale,
      lineHeight: 21 * t.textScale,
      color: t.colors.text,
    },
    kind: { flexDirection: "row", alignItems: "center", gap: 5 },
    kindText: { fontFamily: t.fonts.bold, fontSize: 13 * t.textScale, color: t.colors.textSoft },
    thumb: {
      width: 72,
      height: 72,
      borderRadius: Math.min(14, t.radius.media),
      backgroundColor: t.colors.surfaceRaised,
    },
  });
