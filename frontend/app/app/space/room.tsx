import { Permission, SLOWMODE_CHOICES, type SpaceDetail } from "@realm/contracts";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { alert } from "@/alert";
import { useApi } from "@/data";
import { Icon } from "@/icon";
import { leave } from "@/leave";
import { ApiError, api } from "@/server";
import { AppScreen, Loading, Problem, TopBar } from "@/social/screen";
import { powerIn, roleColour, rolesTopDown } from "@/space/power";
import { privacyOf, slowWords } from "@/space/rooms";
import { type NativeTheme, useStyles, useTheme } from "@/theme";
import { Pill } from "@/ui";

type Kind = "text" | "voice" | "category";

/** What the server will call it: lowercase, dashes for spaces, letters and numbers only. */
const linkName = (raw: string) =>
  raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9_-]/g, "")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");

/**
 * Make or change a room or a group of rooms: its name, what it's for, which group it sits in,
 * slow mode, and who can see it (everyone, or only some roles).
 */
export default function RoomEditor() {
  const { t, accent } = useTheme();
  const s = useStyles(make);
  const router = useRouter();
  const params = useLocalSearchParams<{
    space: string;
    room: string;
    type?: Kind;
    parent?: string;
  }>();
  const space = useApi<SpaceDetail>(`/communities/${params.space}`);
  const existing = space.data?.channels.find((c) => c.id === params.room) ?? null;
  const fresh = params.room === "new";
  const kind: Kind = (existing?.type as Kind | undefined) ?? params.type ?? "text";
  const group = kind === "category";

  const [name, setName] = useState("");
  const [topic, setTopic] = useState("");
  const [parentId, setParentId] = useState<string | null>(params.parent ?? null);
  const [slow, setSlow] = useState<(typeof SLOWMODE_CHOICES)[number]>(0);
  const [closed, setClosed] = useState(false);
  const [roleIds, setRoleIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [ready, setReady] = useState(fresh);

  useEffect(() => {
    if (!space.data || !existing || ready) return;
    setName(existing.name ?? "");
    setTopic(existing.topic ?? "");
    setParentId(existing.parentId);
    setSlow(
      (SLOWMODE_CHOICES as readonly number[]).includes(existing.slowmodeSeconds)
        ? (existing.slowmodeSeconds as (typeof SLOWMODE_CHOICES)[number])
        : 0,
    );
    const p = privacyOf(space.data, existing);
    setClosed(p.private);
    setRoleIds(p.roleIds);
    setReady(true);
  }, [space.data, existing, ready]);

  if (space.error && !space.data) {
    return (
      <AppScreen>
        <TopBar title="Room" />
        <Problem message={space.error} onRetry={space.reload} />
      </AppScreen>
    );
  }
  if (!space.data || !ready) {
    return (
      <AppScreen>
        <TopBar title="Room" />
        <Loading />
      </AppScreen>
    );
  }
  const sp = space.data;
  const power = powerIn(sp);
  const canPrivacy = power.can(Permission.MANAGE_ROLES);
  const groups = sp.channels.filter((c) => c.type === "category");
  const roles = rolesTopDown(sp).filter((r) => r.id !== sp.id);
  const shown = group ? name.trim() : linkName(name);
  const title = fresh
    ? group
      ? "New group"
      : kind === "voice"
        ? "New voice room"
        : "New chat room"
    : group
      ? "Edit the group"
      : "Edit the room";

  async function save() {
    if (!shown) {
      alert("Name it first", group ? "Give the group a name." : "Use letters or numbers.");
      return;
    }
    if (closed && canPrivacy && roleIds.length === 0) {
      alert("Pick who can see it", "Choose at least one role, or turn private off.");
      return;
    }
    setSaving(true);
    const privacy =
      canPrivacy && !group ? { private: closed, roleIds: closed ? roleIds : [] } : undefined;
    try {
      if (fresh) {
        await api(`/communities/${sp.id}/channels`, {
          body: {
            name: name.trim(),
            type: kind,
            ...(group ? {} : { topic: topic.trim() || undefined, parentId: parentId ?? undefined }),
            ...(privacy?.private ? { privacy } : {}),
          },
        });
      } else if (existing) {
        const before = privacyOf(sp, existing);
        const privacyChanged =
          privacy &&
          (privacy.private !== before.private ||
            privacy.roleIds.slice().sort().join() !== before.roleIds.slice().sort().join());
        await api(`/channels/${existing.id}`, {
          method: "PATCH",
          body: {
            name: name.trim(),
            ...(group
              ? {}
              : {
                  topic: topic.trim() || null,
                  parentId,
                  ...(kind === "text" ? { slowmodeSeconds: slow } : {}),
                  ...(privacyChanged ? { privacy } : {}),
                }),
          },
        });
      }
      leave(router, { pathname: "/space/[id]", params: { id: sp.slug } });
    } catch (err) {
      alert("Not saved", err instanceof ApiError ? err.message : "Try again.");
      setSaving(false);
    }
  }

  return (
    <AppScreen>
      <TopBar title={title} />
      <ScrollView contentContainerStyle={s.pad} keyboardShouldPersistTaps="handled">
        <View style={s.preview}>
          <View style={s.previewIcon}>
            <Icon
              name={group ? "ListBullets" : kind === "voice" ? "SpeakerHigh" : "Hash"}
              size={22}
              color={t.colors.text}
            />
            {closed && !group ? (
              <View style={s.lock}>
                <Icon name="LockFill" size={11} color={t.colors.text} />
              </View>
            ) : null}
          </View>
          <View style={s.fill}>
            <Text style={[s.previewName, group && s.previewGroup]} numberOfLines={1}>
              {shown || (group ? "Group name" : "room-name")}
            </Text>
            <Text style={s.line} numberOfLines={2}>
              {group
                ? "Groups keep rooms together, like Game nights or Study corner."
                : topic.trim() || (kind === "voice" ? "Hang out and talk" : "A place to chat")}
            </Text>
          </View>
        </View>

        <Text style={s.label}>Name</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder={
            group ? "Like Game nights" : kind === "voice" ? "Like hangout" : "Like late-night"
          }
          placeholderTextColor={t.colors.textMuted}
          selectionColor={accent}
          cursorColor={accent}
          autoCapitalize={group ? "sentences" : "none"}
          autoCorrect={false}
          maxLength={100}
          style={s.input}
          accessibilityLabel="Name"
        />
        {!group && name && shown !== name.trim() ? (
          <Text style={s.hint}>It'll be called #{shown || "…"}: room names work in links.</Text>
        ) : null}

        {group ? null : (
          <>
            <Text style={s.label}>What's it for? (optional)</Text>
            <TextInput
              value={topic}
              onChangeText={setTopic}
              placeholder="Shown under the name"
              placeholderTextColor={t.colors.textMuted}
              selectionColor={accent}
              cursorColor={accent}
              maxLength={300}
              multiline
              style={[s.input, s.topic]}
              accessibilityLabel="What the room is for"
            />

            {groups.length ? (
              <>
                <Text style={s.label}>Group</Text>
                <View style={s.chips}>
                  {[{ id: null, name: "No group" }, ...groups].map((g) => (
                    <Pressable
                      key={g.id ?? "none"}
                      onPress={() => setParentId(g.id)}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: parentId === g.id }}
                      style={[s.chip, parentId === g.id && { backgroundColor: t.colors.text }]}
                    >
                      <Text style={[s.chipText, parentId === g.id && { color: t.colors.bg }]}>
                        {g.name}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </>
            ) : null}

            {kind === "text" && !fresh ? (
              <>
                <Text style={s.label}>Slow mode</Text>
                <Text style={s.hint}>
                  How long people wait between messages. Moderators don't wait.
                </Text>
                <View style={s.chips}>
                  {SLOWMODE_CHOICES.map((n) => (
                    <Pressable
                      key={n}
                      onPress={() => setSlow(n)}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: slow === n }}
                      style={[s.chip, slow === n && { backgroundColor: t.colors.text }]}
                    >
                      <Text style={[s.chipText, slow === n && { color: t.colors.bg }]}>
                        {n ? slowWords(n) : "Off"}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </>
            ) : null}

            {canPrivacy ? (
              <>
                <View style={s.toggle}>
                  <View style={s.fill}>
                    <Text style={s.toggleTitle}>Private room</Text>
                    <Text style={s.hint}>
                      Only people with the roles you pick can see it. You and admins always can.
                    </Text>
                  </View>
                  <Switch
                    value={closed}
                    onValueChange={setClosed}
                    trackColor={{ false: t.colors.borderStrong, true: accent }}
                    thumbColor="#ffffff"
                    accessibilityLabel="Private room"
                  />
                </View>
                {closed ? (
                  roles.length ? (
                    <View style={s.chips}>
                      {roles.map((r) => {
                        const on = roleIds.includes(r.id);
                        const colour = roleColour(r);
                        return (
                          <Pressable
                            key={r.id}
                            onPress={() =>
                              setRoleIds((ids) =>
                                on ? ids.filter((x) => x !== r.id) : [...ids, r.id],
                              )
                            }
                            accessibilityRole="checkbox"
                            accessibilityState={{ checked: on }}
                            style={[s.chip, on && { backgroundColor: t.colors.text }]}
                          >
                            {on ? (
                              <Icon name="CheckBold" size={13} color={t.colors.bg} />
                            ) : colour ? (
                              <View style={[s.dot, { backgroundColor: colour }]} />
                            ) : null}
                            <Text style={[s.chipText, on && { color: t.colors.bg }]}>{r.name}</Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  ) : (
                    <Text style={s.hint}>Make a role first (Space settings, Roles).</Text>
                  )
                ) : null}
              </>
            ) : null}
          </>
        )}

        <Pill
          label={fresh ? (group ? "Make the group" : "Make the room") : "Save"}
          pending={saving}
          pendingLabel="Saving"
          onPress={save}
        />
      </ScrollView>
    </AppScreen>
  );
}

const make = (t: NativeTheme) =>
  StyleSheet.create({
    fill: { flex: 1, minWidth: 0 },
    pad: { padding: 16, gap: 10, paddingBottom: 120 },
    preview: {
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
      padding: 14,
      borderRadius: t.radius.card,
      borderWidth: 1,
      borderColor: t.colors.border,
      backgroundColor: t.colors.surface,
    },
    previewIcon: {
      width: 46,
      height: 46,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: t.colors.surfaceRaised,
    },
    lock: {
      position: "absolute",
      right: -4,
      bottom: -4,
      width: 20,
      height: 20,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 2,
      borderColor: t.colors.surface,
      backgroundColor: t.colors.surfaceRaised,
    },
    previewName: { fontFamily: t.fonts.bold, fontSize: 17 * t.textScale, color: t.colors.text },
    previewGroup: {
      fontSize: 13.5 * t.textScale,
      textTransform: "uppercase",
      letterSpacing: 0.8,
    },
    line: { fontFamily: t.fonts.body, fontSize: 13.5 * t.textScale, color: t.colors.textSoft },
    label: {
      fontFamily: t.fonts.bold,
      fontSize: 15 * t.textScale,
      color: t.colors.text,
      marginTop: 8,
    },
    hint: {
      fontFamily: t.fonts.body,
      fontSize: 13.5 * t.textScale,
      lineHeight: 19 * t.textScale,
      color: t.colors.textSoft,
    },
    input: {
      minHeight: 50,
      borderRadius: t.radius.input,
      borderWidth: 1.5,
      borderColor: t.colors.borderStrong,
      paddingHorizontal: 14,
      fontFamily: t.fonts.body,
      fontSize: 16 * t.textScale,
      color: t.colors.text,
    },
    topic: { minHeight: 76, paddingTop: 12, textAlignVertical: "top" },
    chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    chip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 13,
      minHeight: 36,
      borderRadius: 18,
      backgroundColor: t.colors.surfaceRaised,
    },
    chipText: { fontFamily: t.fonts.bold, fontSize: 13.5 * t.textScale, color: t.colors.text },
    dot: { width: 9, height: 9, borderRadius: 5 },
    toggle: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      marginTop: 10,
      paddingTop: 12,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: t.colors.border,
    },
    toggleTitle: { fontFamily: t.fonts.bold, fontSize: 15 * t.textScale, color: t.colors.text },
  });
