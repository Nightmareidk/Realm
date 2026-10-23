import {
  type AuditEntry,
  type AutoModRules,
  GLOW_LEVELS,
  has,
  Permission,
  type SpaceDetail,
  type SparkStatus,
} from "@realm/contracts";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import {
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { alert } from "@/alert";
import { useApi } from "@/data";
import { Icon } from "@/icon";
import { ApiError, api } from "@/server";
import { AppScreen, Loading, Problem, TopBar } from "@/social/screen";
import { ago } from "@/social/time";
import { type NativeTheme, useStyles, useTheme } from "@/theme";
import { Pill } from "@/ui";

type Tab = "glow" | "automod" | "log" | "invite";

/** What each audit log action means, in words. */
const ACTIONS: Record<string, string> = {
  "member.kick": "removed a member",
  "member.ban": "banned someone",
  "member.unban": "lifted a ban",
  "member.timeout": "timed someone out",
  "member.update": "changed a member's roles",
  "message.delete": "deleted a message",
  "report.resolve": "dealt with a report",
  "automod.update": "changed AutoMod",
  "spark.give": "gave a Spark",
  "channel.create": "made a room",
  "channel.update": "changed a room",
  "channel.delete": "deleted a room",
  "community.update": "changed the Space",
  "invite.create": "made an invite",
};

/**
 * A Space's settings: its Glow (Sparks people gave it, and what each level unlocks), AutoMod
 * (blocked words, links, invites, and waits for new accounts), the audit log of everything
 * moderators did, and inviting people. What you see depends on what you're allowed to do.
 */
export default function SpaceSettings() {
  const { t } = useTheme();
  const s = useStyles(make);
  const { id } = useLocalSearchParams<{ id: string }>();
  const space = useApi<SpaceDetail>(`/communities/${id}`);
  const [tab, setTab] = useState<Tab>("glow");
  // What you may do here: your roles' permissions together (and the Space-wide role everyone has).
  const perms = space.data
    ? space.data.roles
        .filter((r) => r.id === space.data?.id || space.data?.self.roleIds.includes(r.id))
        .reduce((all, r) => all | BigInt(r.permissions), 0n)
    : 0n;
  const manage = space.data
    ? space.data.ownerId === space.data.self.user.id || has(perms, Permission.MANAGE_COMMUNITY)
    : false;
  const tabs: [Tab, string][] = [
    ["glow", "Glow"],
    ...(manage ? ([["automod", "AutoMod"]] as [Tab, string][]) : []),
    ["log", "Audit log"],
    ["invite", "Invite"],
  ];

  return (
    <AppScreen>
      <TopBar title={space.data?.name ?? "Space"} />
      {space.error && !space.data ? (
        <Problem message={space.error} onRetry={space.reload} />
      ) : !space.data ? (
        <Loading />
      ) : (
        <>
          <View style={s.tabs} accessibilityRole="tablist">
            {tabs.map(([k, label]) => (
              <Pressable
                key={k}
                onPress={() => setTab(k)}
                accessibilityRole="tab"
                accessibilityState={{ selected: tab === k }}
                style={[s.tab, tab === k && { borderBottomColor: t.colors.text }]}
              >
                <Text style={[s.tabText, tab === k && s.tabTextOn]}>{label}</Text>
              </Pressable>
            ))}
          </View>
          {tab === "glow" ? <Glow id={id ?? ""} /> : null}
          {tab === "automod" ? <AutoMod id={id ?? ""} /> : null}
          {tab === "log" ? <Log id={id ?? ""} /> : null}
          {tab === "invite" ? <Invite id={id ?? ""} name={space.data.name} /> : null}
        </>
      )}
    </AppScreen>
  );
}

function Glow({ id }: { id: string }) {
  const { t } = useTheme();
  const s = useStyles(make);
  const status = useApi<SparkStatus>(`/communities/${id}/sparks`);
  const [busy, setBusy] = useState(false);
  async function give() {
    setBusy(true);
    try {
      status.setData(await api<SparkStatus>(`/communities/${id}/sparks`, { body: {} }));
    } catch (err) {
      alert("No Spark given", err instanceof ApiError ? err.message : "Try again.");
    } finally {
      setBusy(false);
    }
  }
  const d = status.data;
  if (!d) return <Loading />;
  const next = GLOW_LEVELS.find((g) => g.level === d.level + 1);
  const progress = next ? Math.min(1, d.count / next.sparks) : 1;
  return (
    <ScrollView contentContainerStyle={s.pad}>
      <View style={s.glowCard}>
        <LinearGradient
          colors={[
            t.colors.lights[0] ?? t.colors.accent,
            t.colors.accent,
            t.colors.lights[2] ?? t.colors.accent,
          ]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <Icon name="Sparkle" size={34} color="#0b0b0e" />
        <Text style={s.glowLevel}>{d.level ? `Glow ${d.level}` : "No Glow yet"}</Text>
        <Text style={s.glowLine}>
          {d.count} {d.count === 1 ? "Spark" : "Sparks"}
          {next ? ` · ${d.toNext} more for ${next.name}` : " · the brightest it gets"}
        </Text>
        <View style={s.bar}>
          <View style={[s.barFill, { width: `${Math.round(progress * 100)}%` }]} />
        </View>
      </View>
      <Pill
        label={d.mine ? `Give another Spark (${d.mine} given)` : "Give this Space a Spark"}
        pending={busy}
        pendingLabel="Giving"
        onPress={give}
      />
      <Text style={s.small}>
        {d.testing
          ? "Sparks are free to try while Realm is being built. Each lasts 30 days; you can give a Space up to two."
          : "Each Spark lasts a month. You can give a Space up to two."}
      </Text>
      {GLOW_LEVELS.map((g) => (
        <View
          key={g.level}
          style={[s.level, d.level >= g.level && { borderColor: t.colors.accent }]}
        >
          <View style={s.levelHead}>
            <Text style={s.levelName}>{g.name}</Text>
            <Text style={s.levelNeed}>
              {d.level >= g.level ? "Unlocked" : `${g.sparks} Sparks`}
            </Text>
          </View>
          {g.perks.map((p) => (
            <View key={p} style={s.perk}>
              <Icon
                name={d.level >= g.level ? "CheckCircleFill" : "Sparkle"}
                size={16}
                color={d.level >= g.level ? t.colors.accent : t.colors.textSoft}
              />
              <Text style={s.perkText}>{p}</Text>
            </View>
          ))}
        </View>
      ))}
      {d.backers.length ? (
        <>
          <Text style={s.heading}>Lighting it up</Text>
          <Text style={s.backers}>{d.backers.map((b) => b.displayName).join(", ")}</Text>
        </>
      ) : null}
    </ScrollView>
  );
}

function AutoMod({ id }: { id: string }) {
  const { t, accent } = useTheme();
  const s = useStyles(make);
  const current = useApi<AutoModRules>(`/communities/${id}/automod`);
  const [rules, setRules] = useState<AutoModRules | null>(null);
  const [words, setWords] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (current.data) {
      setRules(current.data);
      setWords(current.data.words.join(", "));
    }
  }, [current.data]);
  if (!rules) return <Loading />;
  async function save() {
    if (!rules) return;
    setSaving(true);
    try {
      const list = words
        .split(/[,\n]/)
        .map((w) => w.trim())
        .filter(Boolean)
        .slice(0, 200);
      const saved = await api<AutoModRules>(`/communities/${id}/automod`, {
        method: "PUT",
        body: { ...rules, words: list },
      });
      setRules(saved);
      alert("AutoMod saved", "It's in the audit log.");
    } catch (err) {
      alert("Not saved", err instanceof ApiError ? err.message : "Try again.");
    } finally {
      setSaving(false);
    }
  }
  const toggle = (key: "blockLinks" | "blockInvites", title: string, line: string) => (
    <View style={s.toggle}>
      <View style={s.fill}>
        <Text style={s.toggleTitle}>{title}</Text>
        <Text style={s.toggleLine}>{line}</Text>
      </View>
      <Switch
        value={rules[key]}
        onValueChange={(v) => setRules({ ...rules, [key]: v })}
        trackColor={{ true: accent }}
        accessibilityLabel={title}
      />
    </View>
  );
  const stepper = (
    key: "minAccountDays" | "minMemberMinutes",
    title: string,
    unit: string,
    steps: number[],
  ) => (
    <View style={s.toggle}>
      <View style={s.fill}>
        <Text style={s.toggleTitle}>{title}</Text>
        <View style={s.steps}>
          {steps.map((n) => (
            <Pressable
              key={n}
              onPress={() => setRules({ ...rules, [key]: n })}
              accessibilityRole="radio"
              accessibilityState={{ checked: rules[key] === n }}
              style={[s.step, rules[key] === n && { backgroundColor: t.colors.text }]}
            >
              <Text style={[s.stepText, rules[key] === n && { color: t.colors.bg }]}>
                {n ? `${n} ${unit}` : "Off"}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  );
  return (
    <ScrollView contentContainerStyle={s.pad} keyboardShouldPersistTaps="handled">
      <Text style={s.lead}>
        AutoMod stops messages before anyone sees them. Moderators are never held back.
      </Text>
      <Text style={s.toggleTitle}>Blocked words</Text>
      <TextInput
        value={words}
        onChangeText={setWords}
        placeholder="Words or phrases, separated by commas"
        placeholderTextColor={t.colors.textMuted}
        selectionColor={accent}
        multiline
        style={s.words}
        accessibilityLabel="Blocked words"
      />
      {toggle("blockLinks", "Block links", "No web links in messages")}
      {toggle("blockInvites", "Block invites", "No invites to other servers or groups")}
      {stepper("minAccountDays", "Brand-new accounts wait", "days", [0, 1, 3, 7])}
      {stepper("minMemberMinutes", "New members wait", "min", [0, 5, 10, 30])}
      <Pill label="Save AutoMod" pending={saving} pendingLabel="Saving" onPress={save} />
    </ScrollView>
  );
}

function Log({ id }: { id: string }) {
  const s = useStyles(make);
  const log = useApi<{ entries: AuditEntry[] }>(`/communities/${id}/audit-log`);
  if (log.error && !log.data) return <Problem message={log.error} onRetry={log.reload} />;
  if (!log.data) return <Loading />;
  return (
    <ScrollView contentContainerStyle={s.pad}>
      {log.data.entries.length === 0 ? (
        <Text style={s.lead}>Nothing yet. Everything moderators do shows up here, for good.</Text>
      ) : null}
      {log.data.entries.map((e) => (
        <View key={e.id} style={s.entry}>
          <Text style={s.entryText}>
            <Text style={s.bold}>{e.actor?.displayName ?? "Someone"}</Text>{" "}
            {ACTIONS[e.action] ?? e.action.replace(/[._]/g, " ")}
            {e.target?.displayName ? <Text style={s.bold}> {e.target.displayName}</Text> : null}
          </Text>
          {e.reason ? <Text style={s.entryReason}>"{e.reason}"</Text> : null}
          <Text style={s.entryWhen}>{ago(e.createdAt)}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

function Invite({ id, name }: { id: string; name: string }) {
  const s = useStyles(make);
  const [link, setLink] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function make_() {
    setBusy(true);
    try {
      const inv = await api<{ code: string }>(`/communities/${id}/invites`, { body: {} });
      setLink(`https://tomyrealm.com/invite/${inv.code}`);
    } catch (err) {
      alert("No invite made", err instanceof ApiError ? err.message : "Try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <ScrollView contentContainerStyle={s.pad}>
      <Text style={s.lead}>
        Invite friends to {name}. Anyone with the link can join until it runs out.
      </Text>
      {link ? (
        <>
          <Text style={s.link} selectable>
            {link}
          </Text>
          <Pill
            label="Share the link"
            onPress={() => Share.share({ message: `Join ${name} on Realm: ${link}` })}
          />
        </>
      ) : (
        <Pill label="Make an invite link" pending={busy} pendingLabel="Making" onPress={make_} />
      )}
    </ScrollView>
  );
}

const make = (t: NativeTheme) =>
  StyleSheet.create({
    fill: { flex: 1 },
    pad: { padding: 16, gap: 12, paddingBottom: 120 },
    tabs: {
      flexDirection: "row",
      paddingHorizontal: 8,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.colors.border,
    },
    tab: {
      paddingHorizontal: 12,
      minHeight: 44,
      justifyContent: "center",
      borderBottomWidth: 2.5,
      borderBottomColor: "transparent",
    },
    tabText: { fontFamily: t.fonts.bold, fontSize: 14.5 * t.textScale, color: t.colors.textSoft },
    tabTextOn: { color: t.colors.text },
    glowCard: {
      borderRadius: t.radius.card,
      overflow: "hidden",
      padding: 20,
      alignItems: "center",
      gap: 6,
    },
    glowLevel: { fontFamily: t.fonts.display, fontSize: 28 * t.textScale, color: "#0b0b0e" },
    glowLine: { fontFamily: t.fonts.bold, fontSize: 14 * t.textScale, color: "#0b0b0e" },
    bar: {
      alignSelf: "stretch",
      height: 8,
      borderRadius: 4,
      backgroundColor: "rgba(0,0,0,0.2)",
      marginTop: 8,
      overflow: "hidden",
    },
    barFill: { height: 8, borderRadius: 4, backgroundColor: "#0b0b0e" },
    small: {
      fontFamily: t.fonts.body,
      fontSize: 13 * t.textScale,
      color: t.colors.textSoft,
      textAlign: "center",
    },
    level: {
      padding: 14,
      borderRadius: t.radius.card,
      borderWidth: 1.5,
      borderColor: t.colors.border,
      gap: 6,
      backgroundColor: t.colors.surface,
    },
    levelHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    levelName: {
      fontFamily: t.fonts.displayBold,
      fontSize: 17 * t.textScale,
      color: t.colors.heading,
    },
    levelNeed: { fontFamily: t.fonts.bold, fontSize: 13 * t.textScale, color: t.colors.textSoft },
    perk: { flexDirection: "row", alignItems: "center", gap: 8 },
    perkText: {
      fontFamily: t.fonts.body,
      fontSize: 14 * t.textScale,
      color: t.colors.text,
      flex: 1,
    },
    heading: {
      fontFamily: t.fonts.bold,
      fontSize: 15 * t.textScale,
      color: t.colors.text,
      marginTop: 8,
    },
    backers: { fontFamily: t.fonts.body, fontSize: 14 * t.textScale, color: t.colors.textSoft },
    lead: {
      fontFamily: t.fonts.body,
      fontSize: 14.5 * t.textScale,
      lineHeight: 21 * t.textScale,
      color: t.colors.textSoft,
    },
    words: {
      minHeight: 80,
      borderRadius: t.radius.input,
      borderWidth: 1.5,
      borderColor: t.colors.borderStrong,
      padding: 12,
      fontFamily: t.fonts.body,
      fontSize: 15 * t.textScale,
      color: t.colors.text,
      textAlignVertical: "top",
    },
    toggle: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingVertical: 8,
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
    steps: { flexDirection: "row", gap: 6, marginTop: 8, flexWrap: "wrap" },
    step: {
      paddingHorizontal: 12,
      minHeight: 34,
      borderRadius: 17,
      justifyContent: "center",
      backgroundColor: t.colors.surfaceRaised,
    },
    stepText: { fontFamily: t.fonts.bold, fontSize: 13 * t.textScale, color: t.colors.text },
    entry: {
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.colors.border,
    },
    entryText: { fontFamily: t.fonts.body, fontSize: 14.5 * t.textScale, color: t.colors.text },
    bold: { fontFamily: t.fonts.bold },
    entryReason: {
      fontFamily: t.fonts.body,
      fontSize: 13.5 * t.textScale,
      color: t.colors.textSoft,
      marginTop: 2,
    },
    entryWhen: {
      fontFamily: t.fonts.body,
      fontSize: 12.5 * t.textScale,
      color: t.colors.textSoft,
      marginTop: 2,
    },
    link: {
      fontFamily: t.fonts.bold,
      fontSize: 15 * t.textScale,
      color: t.colors.text,
      padding: 14,
      borderRadius: t.radius.input,
      backgroundColor: t.colors.surfaceRaised,
    },
  });
