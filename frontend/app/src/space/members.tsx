import {
  type Ban,
  type Member,
  type MemberList,
  Permission,
  type SpaceDetail,
  TIMEOUT_CHOICES_MS,
} from "@realm/contracts";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { alert } from "../alert";
import { useApi } from "../data";
import { Icon } from "../icon";
import { useLiveEvent } from "../live";
import { ApiError, api } from "../server";
import { useSheet } from "../sheet";
import { Avatar } from "../social/avatar";
import { agoLong } from "../social/time";
import { Verified } from "../social/verified";
import { type NativeTheme, useStyles, useTheme } from "../theme";
import { Pill } from "../ui";
import { powerIn, rankIn, roleColour, rolesTopDown } from "./power";

const TIMEOUT_WORDS: Record<number, string> = {
  60000: "1 minute",
  300000: "5 minutes",
  600000: "10 minutes",
  3600000: "1 hour",
  86400000: "1 day",
  604800000: "1 week",
};

const BAN_WIPE: { hours: 0 | 1 | 24 | 168; label: string }[] = [
  { hours: 0, label: "Keep their messages" },
  { hours: 1, label: "Delete the last hour of their messages" },
  { hours: 24, label: "Delete the last day of their messages" },
  { hours: 168, label: "Delete the last week of their messages" },
];

/** "9 min left", "3 h left", "2 days left". */
function left(until: string) {
  const ms = new Date(until).getTime() - Date.now();
  if (ms <= 0) return null;
  const min = Math.ceil(ms / 60_000);
  if (min < 60) return `${min} min left`;
  const h = Math.ceil(min / 60);
  if (h < 48) return `${h} h left`;
  return `${Math.ceil(h / 24)} days left`;
}

/**
 * Everyone in a Space, highest role first: find someone, see their roles, and (for people below
 * you) give or take roles, time them out, remove or ban them. Bans are listed at the end.
 */
export function Members({
  space,
  onRolesChanged,
}: {
  space: SpaceDetail;
  onRolesChanged: () => void;
}) {
  const { t, accent } = useTheme();
  const s = useStyles(make);
  const sheet = useSheet();
  const router = useRouter();
  const power = powerIn(space);
  const list = useApi<MemberList>(`/communities/${space.id}/members`);
  const bans = useApi<{ bans: Ban[] }>(
    power.can(Permission.BAN_MEMBERS) ? `/communities/${space.id}/bans` : null,
  );
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<string>("all");
  useLiveEvent("COMMUNITY_MEMBER_UPDATE", (m) => {
    if (m.communityId !== space.id || !list.data) return;
    list.setData({
      ...list.data,
      members: list.data.members.map((x) => (x.user.id === m.user.id ? m : x)),
    });
  });
  useLiveEvent("COMMUNITY_MEMBER_ADD", (m) => m.communityId === space.id && list.reload());
  useLiveEvent("COMMUNITY_MEMBER_REMOVE", (m) => m.communityId === space.id && list.reload());

  const roles = rolesTopDown(space).filter((r) => r.id !== space.id);
  const assignable = roles.filter((r) => r.position < power.rank);
  const sorted = useMemo(() => {
    const q = query.trim().toLowerCase().replace(/^@/, "");
    return [...(list.data?.members ?? [])]
      .filter((m) => {
        if (filter === "timeout") return Boolean(m.timeoutUntil && left(m.timeoutUntil));
        if (filter !== "all" && !m.roleIds.includes(filter)) return false;
        return (
          !q ||
          m.user.displayName.toLowerCase().includes(q) ||
          m.user.username.toLowerCase().includes(q) ||
          (m.nickname ?? "").toLowerCase().includes(q)
        );
      })
      .sort(
        (a, b) =>
          rankIn(space, b.user.id, b.roleIds) - rankIn(space, a.user.id, a.roleIds) ||
          a.user.displayName.localeCompare(b.user.displayName),
      );
  }, [list.data, query, filter, space]);
  const timedOut = (list.data?.members ?? []).filter(
    (m) => m.timeoutUntil && left(m.timeoutUntil),
  ).length;

  async function run(what: string, fn: () => Promise<unknown>) {
    try {
      await fn();
      list.reload();
    } catch (err) {
      alert(`Couldn't ${what}`, err instanceof ApiError ? err.message : "Try again.");
    }
  }

  const patch = (m: Member, body: object) =>
    api(`/communities/${space.id}/members/${m.user.id}`, { method: "PATCH", body });

  function rolesFor(m: Member) {
    sheet({
      title: `${m.user.displayName}'s roles`,
      line: "Tap a role to give it or take it away. You can only give roles below your own.",
      actions: assignable.map((r) => {
        const hasIt = m.roleIds.includes(r.id);
        return {
          label: hasIt ? `Take away ${r.name}` : `Give ${r.name}`,
          icon: hasIt ? "CheckCircleFill" : "Plus",
          onPress: () =>
            run("change their roles", async () => {
              const roleIds = hasIt ? m.roleIds.filter((id) => id !== r.id) : [...m.roleIds, r.id];
              await patch(m, { roleIds });
              onRolesChanged();
            }),
        };
      }),
    });
  }

  function timeOut(m: Member) {
    sheet({
      title: `Time out ${m.user.displayName}`,
      line: "They can read but not talk, react or join voice until it ends.",
      actions: TIMEOUT_CHOICES_MS.map((ms) => ({
        label: TIMEOUT_WORDS[ms] ?? `${ms / 60_000} minutes`,
        icon: "Clock",
        onPress: () =>
          run("time them out", () =>
            patch(m, { timeoutUntil: new Date(Date.now() + ms).toISOString() }),
          ),
      })),
    });
  }

  function ban(m: Member) {
    sheet({
      title: `Ban ${m.user.displayName}?`,
      line: "They're removed and can't come back, even with an invite. You can lift it later.",
      actions: BAN_WIPE.map((w) => ({
        label: w.label,
        danger: true,
        onPress: () =>
          run("ban them", () =>
            api(`/communities/${space.id}/bans/${m.user.id}`, {
              method: "PUT",
              body: { deleteMessagesHours: w.hours },
            }).then(() => bans.reload()),
          ),
      })),
    });
  }

  function open(m: Member) {
    const mine = power.above(m);
    const timed = m.timeoutUntil ? left(m.timeoutUntil) : null;
    sheet({
      title: m.nickname ?? m.user.displayName,
      line: `@${m.user.username} · joined ${agoLong(m.joinedAt)}`,
      actions: [
        {
          label: "See their profile",
          icon: "Eye",
          onPress: () =>
            router.push({ pathname: "/user/[username]", params: { username: m.user.username } }),
        },
        ...(mine && power.can(Permission.MANAGE_ROLES) && assignable.length
          ? [{ label: "Roles", icon: "ShieldCheck" as const, onPress: () => rolesFor(m) }]
          : []),
        ...(mine && power.can(Permission.TIMEOUT_MEMBERS)
          ? timed
            ? [
                {
                  label: "End the time-out",
                  icon: "Clock" as const,
                  onPress: () => run("end the time-out", () => patch(m, { timeoutUntil: null })),
                },
              ]
            : [{ label: "Time out", icon: "Clock" as const, onPress: () => timeOut(m) }]
          : []),
        ...(mine && power.can(Permission.KICK_MEMBERS)
          ? [
              {
                label: "Remove from the Space",
                icon: "UserMinus" as const,
                danger: true,
                onPress: () =>
                  alert(
                    `Remove ${m.user.displayName}?`,
                    "They can come back if someone invites them.",
                    [
                      { text: "Keep them", style: "cancel" },
                      {
                        text: "Remove",
                        style: "destructive",
                        onPress: () =>
                          run("remove them", () =>
                            api(`/communities/${space.id}/members/${m.user.id}`, {
                              method: "DELETE",
                            }),
                          ),
                      },
                    ],
                  ),
              },
            ]
          : []),
        ...(mine && power.can(Permission.BAN_MEMBERS)
          ? [{ label: "Ban", icon: "Prohibit" as const, danger: true, onPress: () => ban(m) }]
          : []),
      ],
    });
  }

  const chips: [string, string][] = [
    ["all", `Everyone · ${list.data?.members.length ?? "…"}`],
    ...(timedOut ? ([["timeout", `Timed out · ${timedOut}`]] as [string, string][]) : []),
    ...roles.map((r): [string, string] => [r.id, r.name]),
  ];

  const header = (
    <View style={s.head}>
      <View style={s.search}>
        <Icon name="MagnifyingGlass" size={18} color={t.colors.textSoft} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Find a member"
          placeholderTextColor={t.colors.textMuted}
          selectionColor={accent}
          cursorColor={accent}
          autoCapitalize="none"
          autoCorrect={false}
          style={s.searchInput}
          accessibilityLabel="Find a member"
        />
      </View>
      <FlatList
        horizontal
        data={chips}
        keyExtractor={([k]) => k}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.chips}
        renderItem={({ item: [k, label] }) => {
          const role = space.roles.find((r) => r.id === k);
          const colour = role ? roleColour(role) : null;
          const on = filter === k;
          return (
            <Pressable
              onPress={() => setFilter(k)}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              style={[s.chip, on && { backgroundColor: t.colors.text }]}
            >
              {colour ? <View style={[s.dot, { backgroundColor: colour }]} /> : null}
              <Text style={[s.chipText, on && { color: t.colors.bg }]}>{label}</Text>
            </Pressable>
          );
        }}
      />
    </View>
  );

  const footer =
    power.can(Permission.BAN_MEMBERS) && bans.data?.bans.length ? (
      <View>
        <Text style={s.heading}>Banned · {bans.data.bans.length}</Text>
        {bans.data.bans.map((b) => (
          <View key={b.user.id} style={s.row}>
            <Avatar user={b.user} size={40} />
            <View style={s.fill}>
              <Text style={s.name} numberOfLines={1}>
                {b.user.displayName}
              </Text>
              <Text style={s.line} numberOfLines={2}>
                {b.reason ? `"${b.reason}" · ` : ""}
                {agoLong(b.createdAt)}
              </Text>
            </View>
            <Pill
              size="sm"
              kind="ghost"
              label="Lift ban"
              onPress={() =>
                run("lift the ban", () =>
                  api(`/communities/${space.id}/bans/${b.user.id}`, { method: "DELETE" }).then(() =>
                    bans.reload(),
                  ),
                )
              }
            />
          </View>
        ))}
      </View>
    ) : null;

  return (
    <FlatList
      data={sorted}
      keyExtractor={(m) => m.user.id}
      ListHeaderComponent={header}
      ListFooterComponent={footer}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={s.pad}
      onRefresh={list.reload}
      refreshing={false}
      ListEmptyComponent={
        list.loading ? null : (
          <Text style={s.empty}>
            {list.error ?? (query ? `Nobody here matches "${query}".` : "Nobody in this group.")}
          </Text>
        )
      }
      renderItem={({ item: m }) => {
        const theirs = rolesTopDown(space).filter((r) => m.roleIds.includes(r.id));
        const timed = m.timeoutUntil ? left(m.timeoutUntil) : null;
        const isOwner = m.user.id === space.ownerId;
        return (
          <Pressable
            onPress={() => open(m)}
            accessibilityRole="button"
            accessibilityLabel={`${m.user.displayName}${isOwner ? ", owner" : ""}${theirs.length ? `, ${theirs.map((r) => r.name).join(", ")}` : ""}`}
            accessibilityHint="Opens what you can do"
            style={({ pressed }) => [s.row, pressed && s.pressed]}
          >
            <View>
              <Avatar user={m.user} size={44} />
              {isOwner ? (
                <View style={[s.crown, { backgroundColor: accent }]}>
                  <Icon name="Crown" size={11} color={t.colors.onAccent} />
                </View>
              ) : null}
            </View>
            <View style={s.fill}>
              <View style={s.nameRow}>
                <Text style={s.name} numberOfLines={1}>
                  {m.nickname ?? m.user.displayName}
                </Text>
                <Verified kind={m.user.verified} size={13} />
              </View>
              <View style={s.tags}>
                {isOwner ? <Text style={s.owner}>Owner</Text> : null}
                {theirs.slice(0, 3).map((r) => (
                  <View key={r.id} style={s.tag}>
                    <View
                      style={[s.dot, { backgroundColor: roleColour(r) ?? t.colors.textSoft }]}
                    />
                    <Text style={s.tagText} numberOfLines={1}>
                      {r.name}
                    </Text>
                  </View>
                ))}
                {theirs.length > 3 ? <Text style={s.line}>+{theirs.length - 3}</Text> : null}
                {timed ? (
                  <View style={[s.tag, s.timed]}>
                    <Icon name="Clock" size={12} color={t.colors.danger} />
                    <Text style={[s.tagText, { color: t.colors.danger }]}>{timed}</Text>
                  </View>
                ) : null}
                {!isOwner && !theirs.length && !timed ? (
                  <Text style={s.line}>@{m.user.username}</Text>
                ) : null}
              </View>
            </View>
            <Icon name="DotsThreeBold" size={20} color={t.colors.textSoft} />
          </Pressable>
        );
      }}
    />
  );
}

const make = (t: NativeTheme) =>
  StyleSheet.create({
    fill: { flex: 1, minWidth: 0 },
    pad: { paddingBottom: 120 },
    pressed: { opacity: 0.75 },
    head: { paddingTop: 12, gap: 10 },
    search: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      marginHorizontal: 16,
      paddingHorizontal: 14,
      minHeight: 46,
      borderRadius: t.radius.input,
      backgroundColor: t.colors.surfaceRaised,
    },
    searchInput: {
      flex: 1,
      minWidth: 0,
      fontFamily: t.fonts.body,
      fontSize: 15.5 * t.textScale,
      color: t.colors.text,
      paddingVertical: 10,
    },
    chips: { gap: 8, paddingHorizontal: 16, paddingBottom: 6 },
    chip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 12,
      minHeight: 34,
      borderRadius: 17,
      backgroundColor: t.colors.surfaceRaised,
    },
    chipText: { fontFamily: t.fonts.bold, fontSize: 13 * t.textScale, color: t.colors.text },
    dot: { width: 9, height: 9, borderRadius: 5 },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingHorizontal: 16,
      paddingVertical: 9,
    },
    crown: {
      position: "absolute",
      right: -3,
      bottom: -3,
      width: 20,
      height: 20,
      borderRadius: 10,
      borderWidth: 2,
      borderColor: t.colors.bg,
      alignItems: "center",
      justifyContent: "center",
    },
    nameRow: { flexDirection: "row", alignItems: "center", gap: 4 },
    name: {
      fontFamily: t.fonts.bold,
      fontSize: 15.5 * t.textScale,
      color: t.colors.text,
      flexShrink: 1,
    },
    tags: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6, marginTop: 4 },
    tag: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingHorizontal: 8,
      height: 22,
      borderRadius: 11,
      backgroundColor: t.colors.surfaceRaised,
      maxWidth: 140,
    },
    tagText: { fontFamily: t.fonts.bold, fontSize: 12 * t.textScale, color: t.colors.text },
    timed: { borderWidth: 1, borderColor: t.colors.dangerLine, backgroundColor: "transparent" },
    owner: { fontFamily: t.fonts.bold, fontSize: 12.5 * t.textScale, color: t.colors.accent },
    line: { fontFamily: t.fonts.body, fontSize: 13 * t.textScale, color: t.colors.textSoft },
    heading: {
      fontFamily: t.fonts.bold,
      fontSize: 12.5 * t.textScale,
      color: t.colors.textSoft,
      textTransform: "uppercase",
      letterSpacing: 0.8,
      paddingHorizontal: 18,
      paddingTop: 22,
      paddingBottom: 6,
    },
    empty: {
      fontFamily: t.fonts.body,
      fontSize: 15 * t.textScale,
      color: t.colors.textSoft,
      padding: 20,
      textAlign: "center",
    },
  });
