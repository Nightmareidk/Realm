import { type Channel, Permission, type SpaceDetail } from "@realm/contracts";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, Share, StyleSheet, Text, View } from "react-native";
import { alert } from "@/alert";
import { useApi } from "@/data";
import { Icon } from "@/icon";
import { useLiveEvent } from "@/live";
import { ApiError, api } from "@/server";
import { useSheet } from "@/sheet";
import { AppScreen, Empty, Loading, TopBar } from "@/social/screen";
import { SpaceBadge } from "@/social/space-badge";
import { compact } from "@/social/time";
import { powerIn } from "@/space/power";
import { flatten, moved, privacyOf, type RoomSection, sections, slowWords } from "@/space/rooms";
import { type NativeTheme, themes, useStyles, useTheme } from "@/theme";
import { Pill } from "@/ui";

/**
 * A Space: its rooms, grouped the way its moderators set them up. Chat rooms open the chat; voice
 * rooms join from the website for now. People who manage rooms add, edit, sort and delete them
 * here. Not a member yet: join a public Space from here.
 */
export default function SpaceScreen() {
  const { t } = useTheme();
  const s = useStyles(make);
  const sheet = useSheet();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const space = useApi<SpaceDetail>(`/communities/${id}`);
  const [joining, setJoining] = useState(false);
  const [folded, setFolded] = useState<Set<string>>(new Set());
  const [sorting, setSorting] = useState(false);
  // Rooms added, changed, sorted or hidden by anyone arrive live.
  const mine = (d: { communityId?: string | null }) => d.communityId === space.data?.id;
  useLiveEvent("CHANNEL_CREATE", (c) => mine(c) && space.reload());
  useLiveEvent("CHANNEL_UPDATE", (c) => mine(c) && space.reload());
  useLiveEvent("CHANNEL_DELETE", (c) => mine(c) && space.reload());
  useLiveEvent("COMMUNITY_UPDATE", (c) => c.id === space.data?.id && space.reload());

  async function join() {
    setJoining(true);
    try {
      space.setData(await api<SpaceDetail>(`/communities/${id}/join`, { method: "POST" }));
    } catch (err) {
      alert("Couldn't join", err instanceof ApiError ? err.message : "Try again.");
    } finally {
      setJoining(false);
    }
  }

  if (!space.data) {
    return (
      <AppScreen>
        <TopBar title="Space" />
        {space.loading ? (
          <Loading />
        ) : (
          <Empty
            title="You're not in this Space yet"
            line="Public Spaces open to everyone can be joined right here. Private ones need an invite from a member."
          >
            <Pill label="Join" pending={joining} pendingLabel="Joining" onPress={join} />
          </Empty>
        )}
      </AppScreen>
    );
  }

  const sp = space.data;
  const power = powerIn(sp);
  const manage = power.can(Permission.MANAGE_CHANNELS);
  const list = sections(sp);
  const colour = themes[sp.accent]?.accent ?? t.colors.accent;

  const settings = (tab?: string) =>
    router.push({
      pathname: "/space/settings/[id]",
      params: { id: sp.slug, ...(tab ? { tab } : {}) },
    });
  const editor = (params: Record<string, string>) =>
    router.push({ pathname: "/space/room", params: { space: sp.slug, ...params } });

  async function invite() {
    try {
      const inv = await api<{ code: string }>(`/communities/${sp.id}/invites`, { body: {} });
      await Share.share({
        message: `Join ${sp.name} on Realm: https://tomyrealm.com/invite/${inv.code}`,
      });
    } catch (err) {
      alert("No invite made", err instanceof ApiError ? err.message : "Try again.");
    }
  }

  function add(parentId?: string) {
    sheet({
      title: "Add to the Space",
      actions: [
        {
          label: "Chat room",
          icon: "Hash",
          onPress: () =>
            editor({ room: "new", type: "text", ...(parentId ? { parent: parentId } : {}) }),
        },
        {
          label: "Voice room",
          icon: "SpeakerHigh",
          onPress: () =>
            editor({ room: "new", type: "voice", ...(parentId ? { parent: parentId } : {}) }),
        },
        ...(parentId
          ? []
          : [
              {
                label: "Group of rooms",
                icon: "ListBullets" as const,
                onPress: () => editor({ room: "new", type: "category" }),
              },
            ]),
      ],
    });
  }

  async function move(next: RoomSection[]) {
    if (next === list) return;
    setSorting(true);
    try {
      await api(`/communities/${sp.id}/channels/order`, {
        method: "PUT",
        body: { items: flatten(next) },
      });
      space.reload();
    } catch (err) {
      alert("Couldn't move it", err instanceof ApiError ? err.message : "Try again.");
    } finally {
      setSorting(false);
    }
  }

  function remove(c: Channel) {
    const group = c.type === "category";
    alert(
      group ? `Delete the group "${c.name}"?` : `Delete #${c.name}?`,
      group
        ? "Its rooms stay, they just won't be in a group."
        : "Its messages go with it. This can't be undone.",
      [
        { text: "Keep it", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await api(`/channels/${c.id}`, { method: "DELETE" });
              space.reload();
            } catch (err) {
              alert("Not deleted", err instanceof ApiError ? err.message : "Try again.");
            }
          },
        },
      ],
    );
  }

  function options(c: Channel) {
    const group = c.type === "category";
    sheet({
      title: group ? (c.name ?? "Group") : `#${c.name}`,
      actions: [
        {
          label: group ? "Rename the group" : "Edit the room",
          icon: "NotePencil",
          onPress: () => editor({ room: c.id }),
        },
        ...(group
          ? [{ label: "Add a room here", icon: "Plus" as const, onPress: () => add(c.id) }]
          : []),
        { label: "Move up", icon: "CaretUp", onPress: () => move(moved(list, c.id, -1)) },
        { label: "Move down", icon: "CaretDown", onPress: () => move(moved(list, c.id, 1)) },
        {
          label: group ? "Delete the group" : "Delete the room",
          icon: "Trash",
          danger: true,
          onPress: () => remove(c),
        },
      ],
    });
  }

  function open(c: Channel) {
    if (c.type === "voice") {
      alert(
        `#${c.name} is a voice room`,
        "Join it from the website for now: open your Space at tomyrealm.com. Voice comes to the app in its next build.",
      );
      return;
    }
    router.push({
      pathname: "/chat/[id]",
      params: { id: c.id, title: `#${c.name}`, kind: "room" },
    });
  }

  const roomRow = (c: Channel) => {
    const closed = privacyOf(sp, c).private;
    return (
      <View key={c.id} style={s.room}>
        <Pressable
          onPress={() => open(c)}
          onLongPress={manage ? () => options(c) : undefined}
          accessibilityRole={c.type === "voice" ? "button" : "link"}
          accessibilityLabel={`${c.type === "voice" ? "Voice room" : "Room"} ${c.name}${closed ? ", private" : ""}${c.slowmodeSeconds ? `, slow mode ${slowWords(c.slowmodeSeconds)}` : ""}`}
          accessibilityHint={manage ? "Hold for room options" : undefined}
          style={({ pressed }) => [s.roomMain, pressed && s.pressed]}
        >
          <View style={s.roomIcon}>
            <Icon
              name={c.type === "voice" ? "SpeakerHigh" : "Hash"}
              size={19}
              color={t.colors.textSoft}
            />
            {closed ? (
              <View style={s.lock}>
                <Icon name="LockFill" size={10} color={t.colors.text} />
              </View>
            ) : null}
          </View>
          <View style={s.fill}>
            <Text style={s.roomName} numberOfLines={1}>
              {c.name}
            </Text>
            {c.topic || c.slowmodeSeconds ? (
              <Text style={s.roomTopic} numberOfLines={1}>
                {c.slowmodeSeconds ? `Slow mode ${slowWords(c.slowmodeSeconds)}` : ""}
                {c.slowmodeSeconds && c.topic ? " · " : ""}
                {c.topic ?? ""}
              </Text>
            ) : null}
          </View>
          {manage ? null : <Icon name="CaretRight" size={16} color={t.colors.textSoft} />}
        </Pressable>
        {manage ? (
          <Pressable
            onPress={() => options(c)}
            accessibilityRole="button"
            accessibilityLabel={`Options for ${c.name}`}
            hitSlop={6}
            style={s.more}
          >
            <Icon name="DotsThreeBold" size={18} color={t.colors.textSoft} />
          </Pressable>
        ) : null}
      </View>
    );
  };

  return (
    <AppScreen>
      <TopBar
        title={sp.name}
        right={
          <View style={s.topRight}>
            {manage ? (
              <Pressable
                onPress={() => add()}
                accessibilityRole="button"
                accessibilityLabel="Add a room or group"
                style={s.gear}
              >
                <Icon name="Plus" size={22} color={t.colors.text} />
              </Pressable>
            ) : null}
            <Pressable
              onPress={() => settings()}
              accessibilityRole="button"
              accessibilityLabel="Space settings: members, roles, reports, Glow, AutoMod, invites"
              style={s.gear}
            >
              <Icon name="Gear" size={22} color={t.colors.text} />
            </Pressable>
          </View>
        }
      />
      <ScrollView contentContainerStyle={s.body}>
        <View style={s.poster}>
          <LinearGradient
            colors={[`${colour}55`, `${colour}12`, "transparent"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0.9, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <View style={s.head}>
            <SpaceBadge name={sp.name} accent={sp.accent} size={64} />
            <View style={s.fill}>
              <Text style={s.name} accessibilityRole="header" numberOfLines={2}>
                {sp.name}
              </Text>
              <Text style={s.line}>
                {compact(sp.memberCount)} {sp.memberCount === 1 ? "member" : "members"} ·{" "}
                {sp.visibility === "public" ? "Public" : "Private"}
                {power.owner ? " · Yours" : ""}
              </Text>
            </View>
          </View>
          {sp.description ? <Text style={s.desc}>{sp.description}</Text> : null}
          <View style={s.chips}>
            {power.can(Permission.CREATE_INVITES) ? (
              <Pressable
                onPress={invite}
                accessibilityRole="button"
                style={[s.chip, { backgroundColor: colour }]}
              >
                <Icon name="UserPlus" size={17} color="#0b0b0e" />
                <Text style={[s.chipText, { color: "#0b0b0e" }]}>Invite</Text>
              </Pressable>
            ) : null}
            <Pressable
              onPress={() => settings("members")}
              accessibilityRole="button"
              style={s.chip}
            >
              <Icon name="UsersThree" size={17} color={t.colors.text} />
              <Text style={s.chipText}>Members</Text>
            </Pressable>
            <Pressable onPress={() => settings("glow")} accessibilityRole="button" style={s.chip}>
              <Icon name="Sparkle" size={17} color={t.colors.text} />
              <Text style={s.chipText}>Glow</Text>
            </Pressable>
          </View>
        </View>

        {list.map((sec) => {
          const key = sec.group?.id ?? "top";
          const shut = sec.group ? folded.has(sec.group.id) : false;
          if (!sec.group && sec.rooms.length === 0) return null;
          return (
            <View key={key} style={s.section}>
              {sec.group ? (
                <View style={s.groupRow}>
                  <Pressable
                    onPress={() =>
                      setFolded((f) => {
                        const next = new Set(f);
                        const gid = sec.group?.id ?? "";
                        next.has(gid) ? next.delete(gid) : next.add(gid);
                        return next;
                      })
                    }
                    onLongPress={
                      manage && sec.group ? () => options(sec.group as Channel) : undefined
                    }
                    accessibilityRole="button"
                    accessibilityState={{ expanded: !shut }}
                    accessibilityLabel={`${sec.group.name}, ${sec.rooms.length} rooms`}
                    style={s.groupHead}
                  >
                    <Icon
                      name={shut ? "CaretRight" : "CaretDown"}
                      size={13}
                      color={t.colors.textSoft}
                    />
                    <Text style={s.groupName} numberOfLines={1}>
                      {sec.group.name}
                    </Text>
                  </Pressable>
                  {manage ? (
                    <>
                      <Pressable
                        onPress={() => add(sec.group?.id)}
                        accessibilityRole="button"
                        accessibilityLabel={`Add a room to ${sec.group.name}`}
                        hitSlop={6}
                        style={s.more}
                      >
                        <Icon name="Plus" size={16} color={t.colors.textSoft} />
                      </Pressable>
                      <Pressable
                        onPress={() => options(sec.group as Channel)}
                        accessibilityRole="button"
                        accessibilityLabel={`Options for ${sec.group.name}`}
                        hitSlop={6}
                        style={s.more}
                      >
                        <Icon name="DotsThreeBold" size={16} color={t.colors.textSoft} />
                      </Pressable>
                    </>
                  ) : null}
                </View>
              ) : null}
              {shut ? null : sec.rooms.length ? (
                <View style={[s.card, sorting && s.pressed]}>{sec.rooms.map(roomRow)}</View>
              ) : (
                <Text style={s.emptyGroup}>No rooms in this group yet.</Text>
              )}
            </View>
          );
        })}
      </ScrollView>
    </AppScreen>
  );
}

const make = (t: NativeTheme) =>
  StyleSheet.create({
    fill: { flex: 1, minWidth: 0 },
    pressed: { opacity: 0.7 },
    topRight: { flexDirection: "row" },
    gear: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
    body: { padding: 16, paddingBottom: 120, gap: 6 },
    poster: {
      borderRadius: t.radius.card,
      overflow: "hidden",
      padding: 16,
      gap: 12,
      borderWidth: 1,
      borderColor: t.colors.border,
      backgroundColor: t.colors.surface,
    },
    head: { flexDirection: "row", alignItems: "center", gap: 14 },
    name: { fontFamily: t.fonts.displayBold, fontSize: 24 * t.textScale, color: t.colors.text },
    line: {
      fontFamily: t.fonts.body,
      fontSize: 14 * t.textScale,
      color: t.colors.textSoft,
      marginTop: 2,
    },
    desc: {
      fontFamily: t.fonts.body,
      fontSize: 15 * t.textScale,
      lineHeight: 22 * t.textScale,
      color: t.colors.text,
    },
    chips: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
    chip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 14,
      minHeight: 38,
      borderRadius: 19,
      backgroundColor: t.colors.surfaceRaised,
    },
    chipText: { fontFamily: t.fonts.bold, fontSize: 14 * t.textScale, color: t.colors.text },
    section: { marginTop: 14, gap: 6 },
    groupRow: { flexDirection: "row", alignItems: "center", gap: 4 },
    groupHead: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      minHeight: 32,
      paddingHorizontal: 4,
    },
    groupName: {
      flexShrink: 1,
      fontFamily: t.fonts.bold,
      fontSize: 12.5 * t.textScale,
      color: t.colors.textSoft,
      textTransform: "uppercase",
      letterSpacing: 0.8,
    },
    card: {
      borderRadius: t.radius.card,
      overflow: "hidden",
      backgroundColor: t.colors.surface,
      borderWidth: 1,
      borderColor: t.colors.border,
    },
    room: {
      flexDirection: "row",
      alignItems: "center",
      paddingRight: 8,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.colors.border,
    },
    roomMain: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      minHeight: 58,
      paddingLeft: 12,
      paddingRight: 4,
    },
    roomIcon: {
      width: 36,
      height: 36,
      borderRadius: 11,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: t.colors.surfaceRaised,
    },
    lock: {
      position: "absolute",
      right: -4,
      bottom: -4,
      width: 18,
      height: 18,
      borderRadius: 9,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 2,
      borderColor: t.colors.bg,
      backgroundColor: t.colors.surfaceRaised,
    },
    roomName: { fontFamily: t.fonts.bold, fontSize: 15.5 * t.textScale, color: t.colors.text },
    roomTopic: {
      fontFamily: t.fonts.body,
      fontSize: 13 * t.textScale,
      color: t.colors.textSoft,
      marginTop: 1,
    },
    more: {
      width: 32,
      height: 32,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 16,
    },
    emptyGroup: {
      fontFamily: t.fonts.body,
      fontSize: 13.5 * t.textScale,
      color: t.colors.textSoft,
      paddingHorizontal: 4,
    },
  });
