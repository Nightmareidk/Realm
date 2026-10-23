import {
  type MemberList,
  PERMISSION_GROUPS,
  Permission,
  type Role,
  SPACE_ROLE_LIMIT,
  type SpaceDetail,
} from "@realm/contracts";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { alert } from "../alert";
import { useApi } from "../data";
import { Icon } from "../icon";
import { ApiError, api } from "../server";
import { type NativeTheme, useStyles, useTheme } from "../theme";
import { Pill } from "../ui";
import { powerIn, roleColour, rolesTopDown } from "./power";

/** Colours a role can wear (or none). Picked to read on dark and light grounds alike. */
const COLOURS = [
  0x7ef2c4, 0x6ee7a8, 0x5ad1e6, 0x8ab4ff, 0xb69cff, 0xff8fd8, 0xff6b6b, 0xffa95e, 0xffd866,
  0xd9d9e0,
];

const count = (bits: bigint) => {
  let n = 0;
  for (let b = bits; b > 0n; b >>= 1n) n += Number(b & 1n);
  return n;
};

/**
 * A Space's roles, highest first. Higher roles win, and you change only the ones below yours:
 * make new ones, move them up and down, and pick what each can do in plain words.
 */
export function Roles({ space, onChanged }: { space: SpaceDetail; onChanged: () => void }) {
  const { t } = useTheme();
  const s = useStyles(make);
  const power = powerIn(space);
  const members = useApi<MemberList>(`/communities/${space.id}/members`);
  const [editing, setEditing] = useState<Role | "new" | null>(null);
  const [moving, setMoving] = useState(false);
  const manage = power.can(Permission.MANAGE_ROLES);
  const list = rolesTopDown(space);
  const movable = list.filter((r) => r.id !== space.id && r.position < power.rank);
  const people = (r: Role) =>
    r.id === space.id
      ? (members.data?.members.length ?? space.memberCount)
      : (members.data?.members.filter((m) => m.roleIds.includes(r.id)).length ?? 0);

  async function move(r: Role, by: -1 | 1) {
    const i = movable.findIndex((x) => x.id === r.id);
    const j = i + by;
    if (i < 0 || j < 0 || j >= movable.length) return;
    const order = movable.map((x) => x.id);
    [order[i], order[j]] = [order[j] as string, order[i] as string];
    setMoving(true);
    try {
      await api(`/communities/${space.id}/roles/order`, {
        method: "PUT",
        body: { roleIds: order },
      });
      onChanged();
    } catch (err) {
      alert("Couldn't move it", err instanceof ApiError ? err.message : "Try again.");
    } finally {
      setMoving(false);
    }
  }

  if (editing) {
    return (
      <RoleEditor
        space={space}
        role={editing === "new" ? null : editing}
        onClose={(changed) => {
          setEditing(null);
          if (changed) {
            onChanged();
            members.reload();
          }
        }}
      />
    );
  }

  return (
    <ScrollView contentContainerStyle={s.pad}>
      <Text style={s.lead}>
        Roles decide what people can do here. Higher roles win, and you can only change roles below
        your own.
      </Text>
      {manage && power.rank >= 1 && space.roles.length < SPACE_ROLE_LIMIT ? (
        <Pressable
          onPress={() => setEditing("new")}
          accessibilityRole="button"
          style={({ pressed }) => [s.newRole, pressed && s.pressed]}
        >
          <View style={[s.badge, { backgroundColor: t.colors.accent }]}>
            <Icon name="Plus" size={18} color={t.colors.onAccent} />
          </View>
          <Text style={s.newRoleText}>Make a new role</Text>
        </Pressable>
      ) : null}
      {list.map((r) => {
        const everyone = r.id === space.id;
        const editable = manage && r.position < power.rank;
        const at = movable.findIndex((x) => x.id === r.id);
        const colour = roleColour(r);
        return (
          <View key={r.id} style={s.row}>
            <Pressable
              onPress={() => (editable ? setEditing(r) : null)}
              disabled={!editable}
              accessibilityRole="button"
              accessibilityLabel={`${everyone ? "Everyone" : r.name}, ${people(r)} people`}
              accessibilityHint={editable ? "Opens the role" : "Above you, so you can't change it"}
              style={({ pressed }) => [s.rowMain, pressed && s.pressed]}
            >
              <View style={[s.badge, { backgroundColor: colour ?? t.colors.surfaceRaised }]}>
                <Icon
                  name={everyone ? "UsersThree" : "ShieldCheck"}
                  size={18}
                  color={colour ? "#0b0b0e" : t.colors.text}
                />
              </View>
              <View style={s.fill}>
                <Text style={s.name} numberOfLines={1}>
                  {everyone ? "Everyone" : r.name}
                </Text>
                <Text style={s.line} numberOfLines={1}>
                  {everyone
                    ? "What every member can do"
                    : `${people(r)} ${people(r) === 1 ? "person" : "people"} · ${count(BigInt(r.permissions))} permissions`}
                </Text>
              </View>
              {editable ? null : <Icon name="Lock" size={16} color={t.colors.textSoft} />}
            </Pressable>
            {at >= 0 ? (
              <View style={s.arrows}>
                <Pressable
                  onPress={() => move(r, -1)}
                  disabled={moving || at === 0}
                  accessibilityRole="button"
                  accessibilityLabel={`Move ${r.name} up`}
                  style={[s.arrow, (moving || at === 0) && s.off]}
                >
                  <Icon name="CaretUp" size={16} color={t.colors.text} />
                </Pressable>
                <Pressable
                  onPress={() => move(r, 1)}
                  disabled={moving || at === movable.length - 1}
                  accessibilityRole="button"
                  accessibilityLabel={`Move ${r.name} down`}
                  style={[s.arrow, (moving || at === movable.length - 1) && s.off]}
                >
                  <Icon name="CaretDown" size={16} color={t.colors.text} />
                </Pressable>
              </View>
            ) : null}
          </View>
        );
      })}
    </ScrollView>
  );
}

function RoleEditor({
  space,
  role,
  onClose,
}: {
  space: SpaceDetail;
  role: Role | null;
  onClose: (changed: boolean) => void;
}) {
  const { t, accent } = useTheme();
  const s = useStyles(make);
  const power = powerIn(space);
  const everyone = role?.id === space.id;
  const [name, setName] = useState(role?.name ?? "");
  const [colour, setColour] = useState<number | null>(role ? role.color : (COLOURS[0] ?? null));
  const [hoist, setHoist] = useState(role?.hoist ?? true);
  const [mentionable, setMentionable] = useState(role?.mentionable ?? false);
  const [bits, setBits] = useState<bigint>(role ? BigInt(role.permissions) : 0n);
  const [saving, setSaving] = useState(false);
  const shown = colour === null ? null : `#${colour.toString(16).padStart(6, "0")}`;

  function flip(bit: bigint, on: boolean, danger?: boolean, label?: string) {
    const apply = () => setBits((b) => (on ? b | bit : b & ~bit));
    if (on && danger) {
      alert(
        `Turn on "${label}"?`,
        bit === Permission.ADMINISTRATOR
          ? "Anyone with this role can do everything, in every room, and change almost anything."
          : "Anyone with this role can keep people out of the Space for good.",
        [
          { text: "Leave it off", style: "cancel" },
          { text: "Turn it on", onPress: apply },
        ],
      );
      return;
    }
    apply();
  }

  async function save() {
    if (!everyone && !name.trim()) {
      alert("Name it first", "Give the role a name people will see.");
      return;
    }
    setSaving(true);
    const body = everyone
      ? { permissions: bits.toString() }
      : { name: name.trim(), color: colour, hoist, mentionable, permissions: bits.toString() };
    try {
      if (role) {
        await api(`/communities/${space.id}/roles/${role.id}`, { method: "PATCH", body });
      } else {
        await api(`/communities/${space.id}/roles`, { body });
      }
      onClose(true);
    } catch (err) {
      alert("Not saved", err instanceof ApiError ? err.message : "Try again.");
      setSaving(false);
    }
  }

  function remove() {
    if (!role) return;
    alert(`Delete ${role.name}?`, "Everyone who has it loses it. This can't be undone.", [
      { text: "Keep it", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await api(`/communities/${space.id}/roles/${role.id}`, { method: "DELETE" });
            onClose(true);
          } catch (err) {
            alert("Not deleted", err instanceof ApiError ? err.message : "Try again.");
          }
        },
      },
    ]);
  }

  return (
    <ScrollView contentContainerStyle={s.pad} keyboardShouldPersistTaps="handled">
      <Pressable
        onPress={() => onClose(false)}
        accessibilityRole="button"
        style={s.back}
        hitSlop={8}
      >
        <Icon name="CaretLeft" size={18} color={t.colors.text} />
        <Text style={s.backText}>All roles</Text>
      </Pressable>

      {/* How it looks: a message from someone with this role. */}
      <View style={[s.preview, shown ? { borderColor: shown } : null]}>
        <View style={[s.previewAvatar, { backgroundColor: shown ?? t.colors.surfaceRaised }]}>
          <Text style={s.previewInitial}>{space.self.user.displayName.slice(0, 1)}</Text>
        </View>
        <View style={s.fill}>
          <View style={s.previewHead}>
            <Text style={[s.previewName, shown && !everyone ? { color: shown } : null]}>
              {space.self.user.displayName}
            </Text>
            <View style={[s.previewTag, { backgroundColor: shown ?? t.colors.surfaceRaised }]}>
              <Text style={[s.previewTagText, shown ? { color: "#0b0b0e" } : null]}>
                {everyone ? "Everyone" : name.trim() || "New role"}
              </Text>
            </View>
          </View>
          <Text style={s.line}>This is how messages look with this role.</Text>
        </View>
      </View>

      {everyone ? (
        <Text style={s.lead}>
          Everyone is what every member can do. Other roles add to it, never take away.
        </Text>
      ) : (
        <>
          <Text style={s.label}>Name</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Like Helpers, Artists, Raid crew"
            placeholderTextColor={t.colors.textMuted}
            selectionColor={accent}
            cursorColor={accent}
            maxLength={64}
            style={s.input}
            accessibilityLabel="Role name"
          />
          <Text style={s.label}>Colour</Text>
          <View style={s.swatches}>
            <Pressable
              onPress={() => setColour(null)}
              accessibilityRole="radio"
              accessibilityState={{ checked: colour === null }}
              accessibilityLabel="No colour"
              style={[s.swatch, s.noColour, colour === null && s.swatchOn]}
            >
              <Icon name="X" size={16} color={t.colors.textSoft} />
            </Pressable>
            {COLOURS.map((c) => (
              <Pressable
                key={c}
                onPress={() => setColour(c)}
                accessibilityRole="radio"
                accessibilityState={{ checked: colour === c }}
                accessibilityLabel={`Colour ${c.toString(16)}`}
                style={[
                  s.swatch,
                  { backgroundColor: `#${c.toString(16).padStart(6, "0")}` },
                  colour === c && s.swatchOn,
                ]}
              />
            ))}
          </View>
          <Toggle
            title="Show them apart"
            line="People with it get their own group in the member list."
            value={hoist}
            onChange={setHoist}
          />
          <Toggle
            title="Anyone can @mention it"
            line="Pings everyone with this role."
            value={mentionable}
            onChange={setMentionable}
          />
        </>
      )}

      {PERMISSION_GROUPS.map((g) => (
        <View key={g.title} style={s.group}>
          <Text style={s.groupTitle}>{g.title}</Text>
          {g.items.map((p) => {
            const bit = Permission[p.key];
            const mine = power.owner || (power.perms & bit) === bit;
            return (
              <Toggle
                key={p.key}
                title={p.label}
                line={
                  mine ? p.line : `${p.line} You don't have this yourself, so you can't change it.`
                }
                value={(bits & bit) === bit}
                disabled={!mine}
                danger={p.danger}
                onChange={(on) => flip(bit, on, p.danger, p.label)}
              />
            );
          })}
        </View>
      ))}

      <Pill
        label={role ? "Save the role" : "Make the role"}
        pending={saving}
        pendingLabel="Saving"
        onPress={save}
      />
      {role && !everyone ? (
        <Pressable onPress={remove} accessibilityRole="button" style={s.delete}>
          <Icon name="Trash" size={18} color={t.colors.danger} />
          <Text style={s.deleteText}>Delete the role</Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

function Toggle({
  title,
  line,
  value,
  onChange,
  disabled,
  danger,
}: {
  title: string;
  line: string;
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  const { t, accent } = useTheme();
  const s = useStyles(make);
  return (
    <View style={[s.toggle, disabled && s.off]}>
      <View style={s.fill}>
        <Text style={[s.toggleTitle, danger && { color: t.colors.danger }]}>{title}</Text>
        <Text style={s.toggleLine}>{line}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        trackColor={{ false: t.colors.borderStrong, true: danger ? t.colors.dangerLine : accent }}
        thumbColor="#ffffff"
        accessibilityLabel={title}
      />
    </View>
  );
}

const make = (t: NativeTheme) =>
  StyleSheet.create({
    fill: { flex: 1, minWidth: 0 },
    pad: { padding: 16, gap: 10, paddingBottom: 120 },
    pressed: { opacity: 0.75 },
    off: { opacity: 0.45 },
    lead: {
      fontFamily: t.fonts.body,
      fontSize: 14.5 * t.textScale,
      lineHeight: 21 * t.textScale,
      color: t.colors.textSoft,
    },
    newRole: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      padding: 10,
      borderRadius: t.radius.card,
      borderWidth: 1.5,
      borderStyle: "dashed",
      borderColor: t.colors.borderStrong,
    },
    newRoleText: { fontFamily: t.fonts.bold, fontSize: 15 * t.textScale, color: t.colors.text },
    row: { flexDirection: "row", alignItems: "center", gap: 8 },
    rowMain: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      padding: 10,
      borderRadius: t.radius.card,
      backgroundColor: t.colors.surface,
    },
    badge: {
      width: 38,
      height: 38,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
    },
    name: { fontFamily: t.fonts.bold, fontSize: 15.5 * t.textScale, color: t.colors.text },
    line: {
      fontFamily: t.fonts.body,
      fontSize: 13 * t.textScale,
      color: t.colors.textSoft,
      marginTop: 1,
    },
    arrows: { gap: 4 },
    arrow: {
      width: 34,
      height: 26,
      borderRadius: 8,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: t.colors.surfaceRaised,
    },
    back: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start" },
    backText: { fontFamily: t.fonts.bold, fontSize: 15 * t.textScale, color: t.colors.text },
    preview: {
      flexDirection: "row",
      gap: 12,
      padding: 14,
      borderRadius: t.radius.card,
      borderWidth: 1.5,
      borderColor: t.colors.border,
      backgroundColor: t.colors.surface,
    },
    previewAvatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: "center",
      justifyContent: "center",
    },
    previewInitial: { fontFamily: t.fonts.display, fontSize: 18 * t.textScale, color: "#0b0b0e" },
    previewHead: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
    previewName: { fontFamily: t.fonts.bold, fontSize: 15.5 * t.textScale, color: t.colors.text },
    previewTag: { paddingHorizontal: 8, height: 22, borderRadius: 11, justifyContent: "center" },
    previewTagText: { fontFamily: t.fonts.bold, fontSize: 12 * t.textScale, color: t.colors.text },
    label: {
      fontFamily: t.fonts.bold,
      fontSize: 15 * t.textScale,
      color: t.colors.text,
      marginTop: 6,
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
    swatches: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
    swatch: { width: 36, height: 36, borderRadius: 18 },
    swatchOn: { borderWidth: 3, borderColor: t.colors.text },
    noColour: {
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1.5,
      borderColor: t.colors.borderStrong,
    },
    group: { marginTop: 8 },
    groupTitle: {
      fontFamily: t.fonts.bold,
      fontSize: 12.5 * t.textScale,
      color: t.colors.textSoft,
      textTransform: "uppercase",
      letterSpacing: 0.8,
      paddingBottom: 4,
    },
    toggle: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingVertical: 9,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: t.colors.border,
    },
    toggleTitle: { fontFamily: t.fonts.bold, fontSize: 15 * t.textScale, color: t.colors.text },
    toggleLine: {
      fontFamily: t.fonts.body,
      fontSize: 13.5 * t.textScale,
      color: t.colors.textSoft,
      marginTop: 2,
    },
    delete: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      minHeight: 48,
    },
    deleteText: { fontFamily: t.fonts.bold, fontSize: 15 * t.textScale, color: t.colors.danger },
  });
