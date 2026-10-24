import type { Post } from "@realm/contracts";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useApi } from "../data";
import { mediaSource, webOrigin } from "../server";
import { type NativeTheme, useStyles } from "../theme";

/** A Realm post link in a message: `…/p/123` (or an older `…/u/name?post=123`). */
const POST_LINK = /https?:\/\/[^\s/]+\/(?:p\/(\d{1,20})|u\/[\w.]+\?post=(\d{1,20}))/;

export function linkedPostId(text: string | null | undefined) {
  const m = text ? POST_LINK.exec(text) : null;
  return m ? (m[1] ?? m[2] ?? null) : null;
}

/** Where a post lives on the website: what Send and Copy link share. */
export const postLink = (id: string) => `${webOrigin() ?? "https://tomyrealm.com"}/p/${id}`;

/**
 * A post shared in a chat: the author, the picture and the start of the caption, opening the
 * post. Posts you can't see (private, deleted) say so.
 */
export function PostLinkCard({ id }: { id: string }) {
  const s = useStyles(make);
  const router = useRouter();
  const post = useApi<Post>(`/posts/${id}`);
  const p = post.data;
  if (!p) {
    return (
      <View style={[s.card, s.missing]}>
        <Text style={s.soft}>
          {post.loading ? "Loading the post…" : "This post isn't available."}
        </Text>
      </View>
    );
  }
  const first = p.media[0];
  return (
    <Pressable
      onPress={() => router.push({ pathname: "/post/[id]", params: { id: p.id } })}
      accessibilityRole="link"
      accessibilityLabel={`Post by ${p.author.displayName}${p.caption ? `: ${p.caption}` : ""}`}
      style={s.card}
    >
      <Text style={s.name} numberOfLines={1}>
        {p.author.displayName}
      </Text>
      {first?.kind === "image" ? (
        <Image source={mediaSource(first.url)} style={s.photo} contentFit="cover" />
      ) : null}
      {p.caption ? (
        <Text style={s.caption} numberOfLines={2}>
          <Text style={s.name}>{p.author.username}</Text> {p.caption}
        </Text>
      ) : null}
    </Pressable>
  );
}

const make = (t: NativeTheme) =>
  StyleSheet.create({
    card: {
      width: 220,
      borderRadius: 18,
      overflow: "hidden",
      backgroundColor: t.colors.surfaceRaised,
      marginVertical: 2,
    },
    missing: { padding: 12 },
    soft: { fontFamily: t.fonts.body, fontSize: 13.5 * t.textScale, color: t.colors.textSoft },
    name: {
      fontFamily: t.fonts.bold,
      fontSize: 13.5 * t.textScale,
      color: t.colors.text,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    photo: { width: 220, height: 275 },
    caption: {
      fontFamily: t.fonts.body,
      fontSize: 13.5 * t.textScale,
      color: t.colors.textSoft,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
  });
