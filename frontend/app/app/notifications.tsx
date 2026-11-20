import type {
  NotificationKind,
  NotificationPrefs,
  UpdateNotificationPrefs,
} from "@realm/contracts";
import * as Linking from "expo-linking";
import { useCallback, useEffect, useState } from "react";
import { AppState, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { useApi } from "@/data";
import { Icon } from "@/icon";
import { type PhonePush, phonePushState, turnOffPhonePush, turnOnPhonePush } from "@/push";
import { ApiError, api } from "@/server";
import { AppScreen, Loading, Problem, TopBar } from "@/social/screen";
import { type NativeTheme, useStyles, useTheme } from "@/theme";
import { Pill } from "@/ui";

const KINDS: { kind: NotificationKind; label: string; hint: string }[] = [
  {
    kind: "messages",
    label: "Messages",
    hint: "Chats, group chats, and Spaces of up to 50 people.",
  },
  { kind: "comments", label: "Comments and replies", hint: "On your posts, and replies to you." },
  { kind: "mentions", label: "Mentions and tags", hint: "When someone @mentions or tags you." },
  { kind: "follows", label: "New followers", hint: "New followers and follow requests." },
  { kind: "likes", label: "Likes and reposts", hint: "At most one per post every 10 minutes." },
];

const PHONE_LINE: Record<PhonePush, string> = {
  on: "On for this phone",
  off: "Off on this phone",
  blocked: "Blocked in your phone's settings",
  unsupported: "Phone notifications work in the Android app",
};

/**
 * Notifications: whether this phone gets them, and what about. The choices below are the
 * account's, so they're the same on the website and every phone you use.
 */
export default function Notifications() {
  const { t, accent, onAccent } = useTheme();
  const s = useStyles(make);
  const prefs = useApi<NotificationPrefs>("/users/@me/notification-prefs");
  const [phone, setPhone] = useState<PhonePush | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const check = useCallback(() => {
    phonePushState()
      .then(setPhone)
      .catch(() => setPhone("off"));
  }, []);

  // Back from the phone's own settings (allowed or blocked there): show what's true now.
  useEffect(() => {
    check();
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") check();
    });
    return () => sub.remove();
  }, [check]);

  async function togglePhone() {
    if (phone === "blocked") {
      void Linking.openSettings();
      return;
    }
    setBusy(true);
    setProblem(null);
    try {
      setPhone(phone === "on" ? await turnOffPhonePush() : await turnOnPhonePush());
    } catch {
      setProblem("Couldn't change notifications on this phone. Try again.");
      check();
    } finally {
      setBusy(false);
    }
  }

  async function change(patch: UpdateNotificationPrefs) {
    const before = prefs.data;
    if (!before) return;
    // Show it straight away; put it back if the server says no.
    prefs.setData({
      paused: patch.paused ?? before.paused,
      kinds: { ...before.kinds, ...patch.kinds },
    });
    setProblem(null);
    try {
      prefs.setData(
        await api<NotificationPrefs>("/users/@me/notification-prefs", {
          method: "PUT",
          body: patch,
        }),
      );
    } catch (err) {
      prefs.setData(before);
      setProblem(err instanceof ApiError ? err.message : "That didn't save. Try again.");
    }
  }

  return (
    <AppScreen>
      <TopBar title="Notifications" />
      <ScrollView contentContainerStyle={s.body}>
        <Text style={s.lead}>
          Realm tells you about messages, comments, mentions, new followers and likes while you're
          away.
        </Text>

        <View style={s.card}>
          <View style={s.cardTop}>
            <View style={[s.mark, phone === "on" && { backgroundColor: accent }]}>
              <Icon
                name={phone === "on" ? "BellSimple" : "BellSlash"}
                size={20}
                color={phone === "on" ? onAccent : t.colors.text}
              />
            </View>
            <View style={s.fill}>
              <Text style={s.title}>This phone</Text>
              <Text style={[s.line, phone === "blocked" && { color: t.colors.danger }]}>
                {phone ? PHONE_LINE[phone] : "Checking"}
              </Text>
            </View>
          </View>
          {phone === "blocked" ? (
            <Text style={s.line}>
              Android stops Realm from showing notifications. Allow them for Realm in your phone's
              settings, then come back.
            </Text>
          ) : null}
          {phone && phone !== "unsupported" ? (
            <Pill
              size="md"
              kind={phone === "on" ? "ghost" : "action"}
              label={
                phone === "on"
                  ? "Turn off"
                  : phone === "blocked"
                    ? "Open phone settings"
                    : "Turn on"
              }
              pending={busy}
              pendingLabel="One moment"
              onPress={() => void togglePhone()}
            />
          ) : null}
        </View>

        {problem ? (
          <Text style={s.problem} accessibilityLiveRegion="polite">
            {problem}
          </Text>
        ) : null}

        <Text style={s.heading} accessibilityRole="header">
          What to tell you about
        </Text>
        {prefs.error && !prefs.data ? (
          <Problem message={prefs.error} onRetry={prefs.reload} />
        ) : !prefs.data ? (
          <Loading />
        ) : (
          <View>
            <Row
              label="Pause all"
              hint="Nothing buzzes until you turn this off. Your choices below stay as they are."
              value={prefs.data.paused}
              onChange={(on) => void change({ paused: on })}
            />
            {KINDS.map((k) => (
              <Row
                key={k.kind}
                label={k.label}
                hint={k.hint}
                value={(prefs.data?.kinds[k.kind] ?? true) && !prefs.data?.paused}
                disabled={prefs.data?.paused}
                onChange={(on) => void change({ kinds: { [k.kind]: on } })}
              />
            ))}
          </View>
        )}

        <View style={s.notes}>
          <Text style={s.note}>
            · Only while you're away from Realm: when it's open, the app shows things itself.
          </Text>
          <Text style={s.note}>
            · At most one per chat every couple of minutes; a newer one replaces it.
          </Text>
          <Text style={s.note}>
            · Nothing from people you've blocked or muted, or from Spaces you've muted.
          </Text>
          <Text style={s.note}>
            · Notifications pass through Google's push service (Firebase), like most apps'. Message
            text is included so you can read it at a glance.
          </Text>
          <Text style={s.note}>
            · Android's own settings let you quiet "Messages" or "Likes, comments and follows"
            separately too.
          </Text>
        </View>
      </ScrollView>
    </AppScreen>
  );
}

function Row({
  label,
  hint,
  value,
  disabled,
  onChange,
}: {
  label: string;
  hint: string;
  value: boolean;
  disabled?: boolean;
  onChange: (on: boolean) => void;
}) {
  const { accent } = useTheme();
  const s = useStyles(make);
  return (
    <View style={[s.row, disabled && s.rowOff]}>
      <View style={s.fill}>
        <Text style={s.title}>{label}</Text>
        <Text style={s.line}>{hint}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        trackColor={{ true: accent }}
        accessibilityLabel={label}
        accessibilityHint={hint}
      />
    </View>
  );
}

const make = (t: NativeTheme) =>
  StyleSheet.create({
    body: { padding: 16, paddingBottom: 48 },
    lead: {
      fontFamily: t.fonts.body,
      fontSize: 15 * t.textScale,
      lineHeight: 22 * t.textScale,
      color: t.colors.textSoft,
      marginBottom: 16,
    },
    card: {
      gap: 14,
      padding: 16,
      borderRadius: 18,
      backgroundColor: t.colors.surfaceRaised,
      borderWidth: 1,
      borderColor: t.colors.border,
    },
    cardTop: { flexDirection: "row", alignItems: "center", gap: 12 },
    mark: {
      width: 40,
      height: 40,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: t.colors.surface,
    },
    fill: { flex: 1 },
    heading: {
      fontFamily: t.fonts.displayBold,
      fontSize: 19 * t.textScale,
      color: t.colors.text,
      marginTop: 28,
      marginBottom: 4,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
      paddingVertical: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.colors.border,
    },
    rowOff: { opacity: 0.5 },
    title: { fontFamily: t.fonts.bold, fontSize: 15.5 * t.textScale, color: t.colors.text },
    line: {
      fontFamily: t.fonts.body,
      fontSize: 14 * t.textScale,
      lineHeight: 20 * t.textScale,
      color: t.colors.textSoft,
      marginTop: 2,
    },
    problem: {
      fontFamily: t.fonts.bold,
      fontSize: 14 * t.textScale,
      color: t.colors.danger,
      marginTop: 12,
    },
    notes: { gap: 6, marginTop: 24 },
    note: {
      fontFamily: t.fonts.body,
      fontSize: 13.5 * t.textScale,
      lineHeight: 19 * t.textScale,
      color: t.colors.textSoft,
    },
  });
