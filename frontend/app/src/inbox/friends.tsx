import type { Channel, Relationship } from "@realm/contracts";
import { useRouter } from "expo-router";
import { useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { alert } from "../alert";
import { useApi } from "../data";
import { Icon } from "../icon";
import { useLiveEvent } from "../live";
import { usePresence } from "../presence";
import { ApiError, api } from "../server";
import { Avatar } from "../social/avatar";
import { Verified } from "../social/verified";
import { type NativeTheme, useStyles, useTheme } from "../theme";
import { Pill } from "../ui";

/**
 * Friends, in Messages (as chat apps keep them): add someone by their username, answer requests,
 * and your friends with who's around now first. Friends message each other straight away.
 */
export function Friends() {
  const { t, accent } = useTheme();
  const s = useStyles(make);
  const list = useApi<{ items: Relationship[] }>("/users/@me/relationships");
  const [name, setName] = useState("");
  const [sending, setSending] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  // Requests and new friends arrive live.
  useLiveEvent("RELATIONSHIP_ADD", () => list.reload());
  useLiveEvent("RELATIONSHIP_REMOVE", () => list.reload());

  const items = list.data?.items ?? [];
  const incoming = items.filter((r) => r.type === "pending_incoming");
  const outgoing = items.filter((r) => r.type === "pending_outgoing");
  const friends = items.filter((r) => r.type === "friend");

  async function add() {
    const who = name.trim().replace(/^@/, "").toLowerCase();
    if (!who) return;
    setSending(true);
    setNote(null);
    try {
      const r = await api<{ type: Relationship["type"] }>(
        `/users/@me/relationships/${encodeURIComponent(who)}`,
        {
          method: "PUT",
        },
      );
      setNote(
        r.type === "friend" ? `You and @${who} are friends now.` : `Request sent to @${who}.`,
      );
      setName("");
      list.reload();
    } catch (err) {
      setNote(err instanceof ApiError ? err.message : "That didn't work. Try again.");
    } finally {
      setSending(false);
    }
  }

  async function answer(r: Relationship, yes: boolean) {
    try {
      await api(`/users/@me/relationships/${r.user.username}`, { method: yes ? "PUT" : "DELETE" });
      list.reload();
    } catch (err) {
      alert("That didn't work", err instanceof ApiError ? err.message : "Try again.");
    }
  }

  const header = (
    <View>
      <View style={s.add}>
        <Icon name="UserPlus" size={20} color={t.colors.textSoft} />
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Add a friend by their username"
          placeholderTextColor={t.colors.textMuted}
          selectionColor={accent}
          cursorColor={accent}
          autoCapitalize="none"
          autoCorrect={false}
          onSubmitEditing={add}
          style={s.addInput}
          accessibilityLabel="Friend's username"
        />
        <Pill size="sm" label="Add" pending={sending} pendingLabel="Adding" onPress={add} />
      </View>
      {note ? <Text style={s.note}>{note}</Text> : null}
      {incoming.length ? (
        <Text style={s.heading}>Asked to be your friend · {incoming.length}</Text>
      ) : null}
      {incoming.map((r) => (
        <Row key={r.user.id} r={r} line="Wants to be friends">
          <Pill size="sm" label="Accept" onPress={() => answer(r, true)} />
          <Pill size="sm" kind="ghost" label="Decline" onPress={() => answer(r, false)} />
        </Row>
      ))}
      {outgoing.length ? <Text style={s.heading}>Waiting on them · {outgoing.length}</Text> : null}
      {outgoing.map((r) => (
        <Row key={r.user.id} r={r} line="Request sent">
          <Pill size="sm" kind="ghost" label="Cancel" onPress={() => answer(r, false)} />
        </Row>
      ))}
      <Text style={s.heading}>Friends · {friends.length}</Text>
    </View>
  );

  return (
    <FlatList
      data={friends}
      keyExtractor={(r) => r.user.id}
      ListHeaderComponent={header}
      renderItem={({ item }) => <FriendRow r={item} onRemoved={list.reload} />}
      ListEmptyComponent={
        list.loading ? null : (
          <Text style={s.empty}>
            No friends here yet. Add someone by their username, or accept a request.
          </Text>
        )
      }
      onRefresh={list.reload}
      refreshing={false}
      contentContainerStyle={s.pad}
    />
  );
}

function Row({ r, line, children }: { r: Relationship; line: string; children?: React.ReactNode }) {
  const s = useStyles(make);
  const router = useRouter();
  return (
    <View style={s.row}>
      <Pressable
        onPress={() =>
          router.push({ pathname: "/user/[username]", params: { username: r.user.username } })
        }
        accessibilityRole="link"
        style={s.who}
      >
        <Avatar user={r.user} size={44} />
        <View style={s.fill}>
          <View style={s.nameRow}>
            <Text style={s.name} numberOfLines={1}>
              {r.user.displayName}
            </Text>
            <Verified kind={r.user.verified} size={13} />
          </View>
          <Text style={s.line} numberOfLines={1}>
            @{r.user.username} · {line}
          </Text>
        </View>
      </Pressable>
      <View style={s.actions}>{children}</View>
    </View>
  );
}

function FriendRow({ r, onRemoved }: { r: Relationship; onRemoved: () => void }) {
  const { t } = useTheme();
  const s = useStyles(make);
  const router = useRouter();
  const status = usePresence(r.user.id);
  async function message() {
    try {
      const dm = await api<Channel>("/users/@me/channels", { body: { recipientIds: [r.user.id] } });
      router.push({
        pathname: "/chat/[id]",
        params: { id: dm.id, title: r.user.displayName, kind: "dm" },
      });
    } catch (err) {
      alert("Can't message them", err instanceof ApiError ? err.message : "Try again.");
    }
  }
  function remove() {
    alert(`Remove ${r.user.displayName} as a friend?`, "You can still follow each other.", [
      { text: "Keep", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          await api(`/users/@me/relationships/${r.user.username}`, { method: "DELETE" }).catch(
            () => {},
          );
          onRemoved();
        },
      },
    ]);
  }
  const line =
    status === "online"
      ? "Active now"
      : status === "idle"
        ? "Away"
        : status === "dnd"
          ? "Busy"
          : `@${r.user.username}`;
  return (
    <View style={s.row}>
      <Pressable
        onPress={() =>
          router.push({ pathname: "/user/[username]", params: { username: r.user.username } })
        }
        onLongPress={remove}
        accessibilityRole="link"
        accessibilityHint="Hold to remove as a friend"
        style={s.who}
      >
        <View>
          <Avatar user={r.user} size={44} />
          {status === "online" ? <View style={s.dot} /> : null}
        </View>
        <View style={s.fill}>
          <View style={s.nameRow}>
            <Text style={s.name} numberOfLines={1}>
              {r.user.displayName}
            </Text>
            <Verified kind={r.user.verified} size={13} />
          </View>
          <Text
            style={[s.line, status === "online" && { color: t.colors.presence }]}
            numberOfLines={1}
          >
            {line}
          </Text>
        </View>
      </Pressable>
      <Pressable
        onPress={message}
        accessibilityRole="button"
        accessibilityLabel={`Message ${r.user.displayName}`}
        style={s.round}
      >
        <Icon name="ChatCircle" size={20} color={t.colors.text} />
      </Pressable>
    </View>
  );
}

const make = (t: NativeTheme) =>
  StyleSheet.create({
    fill: { flex: 1 },
    pad: { paddingBottom: 120 },
    add: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      margin: 16,
      marginBottom: 6,
      paddingLeft: 14,
      paddingRight: 6,
      minHeight: 50,
      borderRadius: t.radius.input,
      backgroundColor: t.colors.surfaceRaised,
    },
    addInput: {
      flex: 1,
      minWidth: 0,
      fontFamily: t.fonts.body,
      fontSize: 15.5 * t.textScale,
      color: t.colors.text,
      paddingVertical: 10,
    },
    note: {
      fontFamily: t.fonts.body,
      fontSize: 13.5 * t.textScale,
      color: t.colors.textSoft,
      paddingHorizontal: 18,
    },
    heading: {
      fontFamily: t.fonts.bold,
      fontSize: 12.5 * t.textScale,
      color: t.colors.textSoft,
      textTransform: "uppercase",
      letterSpacing: 0.8,
      paddingHorizontal: 18,
      paddingTop: 18,
      paddingBottom: 6,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingHorizontal: 16,
      paddingVertical: 8,
    },
    who: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12 },
    nameRow: { flexDirection: "row", alignItems: "center", gap: 4 },
    name: {
      fontFamily: t.fonts.bold,
      fontSize: 15.5 * t.textScale,
      color: t.colors.text,
      flexShrink: 1,
    },
    line: {
      fontFamily: t.fonts.body,
      fontSize: 13.5 * t.textScale,
      color: t.colors.textSoft,
      marginTop: 1,
    },
    actions: { flexDirection: "row", gap: 6 },
    round: {
      width: 42,
      height: 42,
      borderRadius: 21,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: t.colors.surfaceRaised,
    },
    dot: {
      position: "absolute",
      right: -1,
      bottom: -1,
      width: 14,
      height: 14,
      borderRadius: 7,
      borderWidth: 2.5,
      borderColor: t.colors.bg,
      backgroundColor: t.colors.presence,
    },
    empty: {
      fontFamily: t.fonts.body,
      fontSize: 15 * t.textScale,
      color: t.colors.textSoft,
      padding: 20,
      lineHeight: 22 * t.textScale,
    },
  });
