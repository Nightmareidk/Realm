import type { Channel, Conversation, SearchResults, UserSummary } from "@realm/contracts";
import * as Clipboard from "expo-clipboard";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { FlatList, Pressable, Share, StyleSheet, Text, TextInput, View } from "react-native";
import { useApi } from "@/data";
import { Icon } from "@/icon";
import { leave } from "@/leave";
import { ApiError, api } from "@/server";
import { useSession } from "@/session";
import { Avatar } from "@/social/avatar";
import { AppScreen, TopBar } from "@/social/screen";
import { type NativeTheme, useStyles, useTheme } from "@/theme";
import { Pill } from "@/ui";

type Target = { key: string; label: string; user?: UserSummary; channelId?: string };

/**
 * Send a post or a profile to people in Realm (the paper plane): your recent chats first, or
 * anyone you search for; pick several, add a note. It arrives in each chat as a card. Copying the
 * link and sharing outside Realm are here too.
 */
export default function Send() {
  const { t, accent } = useTheme();
  const s = useStyles(make);
  const router = useRouter();
  const { link, what } = useLocalSearchParams<{ link: string; what?: string }>();
  const { session } = useSession();
  const me = session.status === "signedIn" ? session.user.id : null;
  const inbox = useApi<{ conversations: Conversation[] }>("/users/@me/channels");
  const [query, setQuery] = useState("");
  const [people, setPeople] = useState<UserSummary[]>([]);
  const [picked, setPicked] = useState<Target[]>([]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    const q = query.trim().replace(/^@/, "");
    if (q.length < 2) {
      setPeople([]);
      return;
    }
    const timer = setTimeout(() => {
      api<SearchResults>(`/search?q=${encodeURIComponent(q)}`)
        .then((r) => setPeople(r.users.filter((u) => u.id !== me).slice(0, 12)))
        .catch(() => {});
    }, 220);
    return () => clearTimeout(timer);
  }, [query, me]);

  const recent: Target[] = (inbox.data?.conversations ?? [])
    .filter((c) => !c.request)
    .slice(0, 16)
    .map((c) => {
      const other = c.recipients.find((r) => r.id !== me);
      return {
        key: `c${c.id}`,
        label:
          c.name ??
          c.recipients
            .filter((r) => r.id !== me)
            .map((r) => r.displayName)
            .join(", "),
        user: other,
        channelId: c.id,
      };
    });
  const shown: Target[] =
    query.trim().length >= 2
      ? people.map((u) => ({ key: `u${u.id}`, label: u.displayName, user: u }))
      : recent;
  const on = (x: Target) => picked.some((p) => p.key === x.key);

  async function send() {
    if (!picked.length || !link) return;
    setBusy(true);
    setStatus(null);
    try {
      for (const x of picked) {
        const channelId =
          x.channelId ??
          (x.user
            ? (await api<Channel>("/users/@me/channels", { body: { recipientIds: [x.user.id] } }))
                .id
            : null);
        if (!channelId) continue;
        await api(`/channels/${channelId}/messages`, {
          body: { content: note.trim() ? `${note.trim()}\n${link}` : link },
        });
      }
      setStatus("Sent");
      setTimeout(() => leave(router), 700);
    } catch (err) {
      setStatus(err instanceof ApiError ? err.message : "Not sent. Try again.");
      setBusy(false);
    }
  }

  return (
    <AppScreen>
      <TopBar title={`Send ${what ?? ""}`.trim()} />
      <View style={s.searchRow}>
        <Icon name="MagnifyingGlass" size={18} color={t.colors.textSoft} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search people"
          placeholderTextColor={t.colors.textMuted}
          selectionColor={accent}
          cursorColor={accent}
          autoCapitalize="none"
          autoCorrect={false}
          style={s.search}
          accessibilityLabel="Search people"
        />
      </View>
      <FlatList
        data={shown}
        numColumns={4}
        keyExtractor={(x) => x.key}
        contentContainerStyle={s.grid}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <Text style={s.empty}>
            {query.trim().length >= 2
              ? "Nobody by that name."
              : "Search for someone to send it to."}
          </Text>
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() =>
              setPicked((p) =>
                on(item) ? p.filter((x) => x.key !== item.key) : [...p, item].slice(0, 15),
              )
            }
            accessibilityRole="checkbox"
            accessibilityState={{ checked: on(item) }}
            accessibilityLabel={item.label}
            style={s.cell}
          >
            <View>
              {item.user ? (
                <Avatar user={item.user} size={60} />
              ) : (
                <View style={[s.groupFace, { backgroundColor: t.colors.surfaceRaised }]} />
              )}
              {on(item) ? (
                <View style={[s.check, { backgroundColor: accent }]}>
                  <Icon name="CheckBold" size={12} color={t.colors.onAccent} />
                </View>
              ) : null}
            </View>
            <Text style={s.name} numberOfLines={2}>
              {item.label}
            </Text>
          </Pressable>
        )}
      />
      <View style={s.foot}>
        {picked.length ? (
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="Write a message…"
            placeholderTextColor={t.colors.textMuted}
            selectionColor={accent}
            maxLength={500}
            style={s.note}
            accessibilityLabel="Write a message"
          />
        ) : null}
        {status ? <Text style={s.status}>{status}</Text> : null}
        <View style={s.row}>
          <Pressable
            onPress={async () => {
              if (!link) return;
              await Clipboard.setStringAsync(link);
              setStatus("Link copied");
            }}
            accessibilityRole="button"
            accessibilityLabel="Copy link"
            style={s.round}
          >
            <Icon name="Link" size={20} color={t.colors.text} />
          </Pressable>
          <Pressable
            onPress={() => link && Share.share({ message: link })}
            accessibilityRole="button"
            accessibilityLabel="Share outside Realm"
            style={s.round}
          >
            <Icon name="ArrowSquareOut" size={20} color={t.colors.text} />
          </Pressable>
          <Pill
            label={picked.length > 1 ? `Send separately (${picked.length})` : "Send"}
            pending={busy}
            pendingLabel="Sending"
            onPress={send}
            style={s.grow}
          />
        </View>
      </View>
    </AppScreen>
  );
}

const make = (t: NativeTheme) =>
  StyleSheet.create({
    grow: { flex: 1 },
    searchRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      marginHorizontal: 16,
      marginTop: 8,
      paddingHorizontal: 14,
      minHeight: 46,
      borderRadius: 23,
      backgroundColor: t.colors.surfaceRaised,
    },
    search: {
      flex: 1,
      fontFamily: t.fonts.body,
      fontSize: 15.5 * t.textScale,
      color: t.colors.text,
      paddingVertical: 10,
    },
    grid: { padding: 12, paddingBottom: 20 },
    cell: { width: "25%", alignItems: "center", gap: 6, paddingVertical: 10 },
    groupFace: { width: 60, height: 60, borderRadius: 30 },
    check: {
      position: "absolute",
      right: -2,
      bottom: -2,
      width: 24,
      height: 24,
      borderRadius: 12,
      borderWidth: 2.5,
      borderColor: t.colors.bg,
      alignItems: "center",
      justifyContent: "center",
    },
    name: {
      fontFamily: t.fonts.body,
      fontSize: 12.5 * t.textScale,
      color: t.colors.text,
      textAlign: "center",
      paddingHorizontal: 4,
    },
    empty: {
      fontFamily: t.fonts.body,
      fontSize: 15 * t.textScale,
      color: t.colors.textSoft,
      textAlign: "center",
      padding: 24,
    },
    foot: {
      gap: 10,
      padding: 16,
      paddingBottom: 28,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: t.colors.border,
    },
    note: {
      minHeight: 46,
      borderRadius: 23,
      paddingHorizontal: 16,
      backgroundColor: t.colors.surfaceRaised,
      fontFamily: t.fonts.body,
      fontSize: 15.5 * t.textScale,
      color: t.colors.text,
    },
    status: { fontFamily: t.fonts.bold, fontSize: 14 * t.textScale, color: t.colors.textSoft },
    row: { flexDirection: "row", alignItems: "center", gap: 10 },
    round: {
      width: 48,
      height: 48,
      borderRadius: 24,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: t.colors.surfaceRaised,
    },
  });
