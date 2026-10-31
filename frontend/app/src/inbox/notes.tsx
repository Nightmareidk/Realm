import type { Channel, Note, NoteList, Sound } from "@realm/contracts";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useApi } from "../data";
import { Icon } from "../icon";
import { playSound } from "../music/player";
import { ApiError, api } from "../server";
import { useSession } from "../session";
import { useSheet } from "../sheet";
import { Avatar } from "../social/avatar";
import { type NativeTheme, useStyles, useTheme } from "../theme";

const CLOSE_BG = "#14532d";

async function playNote(n: Note) {
  if (!n.sound) return;
  try {
    const s = await api<Sound>(`/sounds/${n.sound.id}`);
    void playSound(
      s,
      n.sound.startMs,
      30_000,
      `note:${n.author.id}`,
      `${n.author.displayName}'s note`,
    );
  } catch {}
}

/** The thought bubble above a face. */
function Bubble({ note, empty }: { note: Note | null; empty?: string }) {
  const { t } = useTheme();
  const s = useStyles(make);
  const close = note?.audience === "close_friends";
  return (
    <View style={[s.bubble, close && { backgroundColor: CLOSE_BG }]}>
      {note?.sound ? (
        <View style={s.songRow}>
          <Icon name="MusicNotes" size={10} color={close ? "#ffffff" : t.colors.text} />
          <Text style={[s.bubbleSong, close && s.white]} numberOfLines={1}>
            {note.sound.title}
          </Text>
        </View>
      ) : null}
      {note?.text ? (
        <Text style={[s.bubbleText, close && s.white]} numberOfLines={2}>
          {note.text}
        </Text>
      ) : !note ? (
        <Text style={[s.bubbleText, { color: t.colors.textSoft }]}>{empty}</Text>
      ) : null}
    </View>
  );
}

/**
 * Notes at the top of the Inbox: a short line (and a song) above each face for a day. Yours
 * first; tap it to write one. Tap someone's to hear their song and answer them in a chat.
 */
export function NotesRow() {
  const s = useStyles(make);
  const router = useRouter();
  const sheet = useSheet();
  const { session } = useSession();
  const me = session.status === "signedIn" ? session.user : null;
  const list = useApi<NoteList>("/notes");
  useFocusEffect(
    useCallback(() => {
      list.reload();
    }, [list.reload]),
  );
  if (!me || !list.data) return null;

  const open = (n: Note) => {
    void playNote(n);
    sheet({
      title: `${n.author.displayName}'s note`,
      line: [n.text, n.sound ? `♪ ${n.sound.title} · ${n.sound.artist}` : ""]
        .filter(Boolean)
        .join("\n"),
      actions: [
        {
          label: `Reply to ${n.author.displayName.split(" ")[0]}`,
          icon: "ChatCircle",
          onPress: async () => {
            try {
              const dm = await api<Channel>("/users/@me/channels", {
                body: { recipientIds: [n.author.id] },
              });
              router.push({ pathname: "/chat/[id]", params: { id: dm.id } });
            } catch (err) {
              sheet({
                title: "Can't message them",
                line: err instanceof ApiError ? err.message : "Try again.",
                actions: [],
              });
            }
          },
        },
      ],
    });
  };

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={s.row}
      accessibilityLabel="Notes"
    >
      <Pressable
        onPress={() => router.push("/note")}
        accessibilityRole="button"
        accessibilityLabel={list.data.mine ? "Change your note" : "Share a note"}
        style={s.person}
      >
        <Bubble note={list.data.mine} empty="Share a note" />
        <Avatar user={me} size={60} />
        <Text style={s.name}>Your note</Text>
      </Pressable>
      {list.data.items.map((n) => (
        <Pressable
          key={n.author.id}
          onPress={() => open(n)}
          accessibilityRole="button"
          accessibilityLabel={`${n.author.displayName}'s note: ${n.text}${n.sound ? `, with ${n.sound.title}` : ""}`}
          style={s.person}
        >
          <Bubble note={n} />
          <Avatar user={n.author} size={60} />
          <Text style={s.name} numberOfLines={1}>
            {n.author.displayName.split(" ")[0]}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const make = (t: NativeTheme) =>
  StyleSheet.create({
    row: { gap: 14, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 8 },
    person: { width: 76, alignItems: "center", paddingTop: 30 },
    bubble: {
      position: "absolute",
      top: 0,
      zIndex: 2,
      maxWidth: 92,
      paddingHorizontal: 9,
      paddingVertical: 5,
      borderRadius: 14,
      backgroundColor: t.colors.surfaceRaised,
    },
    songRow: { flexDirection: "row", alignItems: "center", gap: 3 },
    bubbleSong: { fontFamily: t.fonts.bold, fontSize: 10.5 * t.textScale, color: t.colors.text },
    bubbleText: {
      fontFamily: t.fonts.body,
      fontSize: 11 * t.textScale,
      lineHeight: 14 * t.textScale,
      color: t.colors.text,
    },
    white: { color: "#ffffff" },
    name: {
      marginTop: 4,
      fontFamily: t.fonts.body,
      fontSize: 12 * t.textScale,
      color: t.colors.textSoft,
    },
  });
