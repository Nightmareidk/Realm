import type { ReportReason, ReportReceipt } from "@realm/contracts";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon } from "@/icon";
import { ApiError, api } from "@/server";
import { KIND_NAME, type ReportKind, useSafety } from "@/social/safety";
import { AppScreen, TopBar } from "@/social/screen";
import { fonts, roles } from "@/theme";
import { Field, Notice, Pill } from "@/ui";

/** The reasons, in the words people use. */
const REASONS: { id: ReportReason; label: string }[] = [
  { id: "spam", label: "Spam or a scam" },
  { id: "harassment", label: "Bullying or harassment" },
  { id: "hate", label: "Hate speech or symbols" },
  { id: "violence", label: "Threats or violence" },
  { id: "sexual_content", label: "Nudity or sexual content" },
  { id: "sexual_minors", label: "Sexual content involving someone under 18" },
  { id: "self_harm", label: "Self-harm or suicide" },
  { id: "impersonation", label: "Pretending to be someone else" },
  { id: "other", label: "Something else" },
];

/** When someone may be in danger, the report isn't the fastest help. */
const URGENT: ReportReason[] = ["violence", "self_harm", "sexual_minors"];

/**
 * Report a post, comment, message or account: pick why, add a line if you like, send. Then say
 * plainly what happens next, and offer the block as the thing that works straight away.
 */
export default function Report() {
  const params = useLocalSearchParams<{
    kind: ReportKind;
    id: string;
    userId: string;
    username: string;
    name: string;
  }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const safety = useSafety();
  const kind = params.kind ?? "post";
  const thing = KIND_NAME[kind];
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState("");
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<ReportReceipt | null>(null);
  const author = { id: params.userId, username: params.username, displayName: params.name };

  async function send() {
    if (!reason) return setNotice(`Pick why you're reporting this ${thing}.`);
    setNotice(null);
    setPending(true);
    try {
      setReceipt(
        await api<ReportReceipt>("/reports", {
          body: {
            targetType: kind,
            targetId: params.id,
            reason,
            ...(details.trim() ? { details: details.trim() } : {}),
          },
        }),
      );
    } catch (err) {
      setNotice(err instanceof ApiError ? err.message : "Something went wrong. Try again.");
    } finally {
      setPending(false);
    }
  }

  if (receipt) {
    return (
      <AppScreen>
        <TopBar title="Report sent" />
        <ScrollView contentContainerStyle={[s.body, { paddingBottom: insets.bottom + 24 }]}>
          <View style={s.doneMark}>
            <Icon name="ShieldCheck" size={30} color={roles.success} />
          </View>
          <Text style={s.title} accessibilityRole="header">
            Thanks for telling us.
          </Text>
          <Text style={s.lead}>{nextSteps(receipt, kind)}</Text>
          {reason && URGENT.includes(reason) ? (
            <Text style={s.lead}>
              If someone is in danger right now, call your local emergency number.
            </Text>
          ) : null}
          <Text style={s.lead}>Who reported it stays private.</Text>
          <View style={s.doneActions}>
            <Pill
              kind="ghost"
              label={`Block @${author.username}`}
              onPress={() =>
                safety.block({ ...author, avatarUrl: null, accentColor: null }, () =>
                  router.dismissAll(),
                )
              }
            />
            <Pill label="Done" onPress={() => router.back()} />
          </View>
        </ScrollView>
      </AppScreen>
    );
  }

  return (
    <AppScreen>
      <TopBar title={`Report ${thing}`} />
      <KeyboardAvoidingView behavior="padding" style={s.fill}>
        <ScrollView
          contentContainerStyle={[s.body, { paddingBottom: insets.bottom + 24 }]}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={s.title} accessibilityRole="header">
            Why are you reporting this {thing}?
          </Text>
          <Text style={s.lead}>
            {kind === "user" ? `About @${params.username}.` : `${params.name}'s ${thing}.`} They
            won't know it was you.
          </Text>
          <View style={s.reasons} accessibilityRole="radiogroup">
            {REASONS.map((r) => {
              const on = reason === r.id;
              return (
                <Pressable
                  key={r.id}
                  onPress={() => {
                    setReason(r.id);
                    setNotice(null);
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on }}
                  style={({ pressed }) => [s.reason, on && s.reasonOn, pressed && s.pressed]}
                >
                  <View style={[s.radio, on && s.radioOn]}>
                    {on ? <View style={s.radioDot} /> : null}
                  </View>
                  <Text style={s.reasonText}>{r.label}</Text>
                </Pressable>
              );
            })}
          </View>
          <Field
            label="Anything else? (optional)"
            hint="What happened, in a line or two. It helps whoever looks at it."
            value={details}
            onChangeText={setDetails}
            multiline
            maxLength={1000}
            style={s.details}
          />
          <View style={s.send}>
            {notice ? <Notice>{notice}</Notice> : null}
            <Pill label="Send report" pendingLabel="Sending" pending={pending} onPress={send} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </AppScreen>
  );
}

/** What happens next, honestly: who looks at it, or that nobody does and the block is yours. */
function nextSteps(r: ReportReceipt, kind: ReportKind) {
  const hidden = r.hidden ? "It's hidden now. " : "";
  if (r.goesTo === "realm") return `${hidden}Realm will look at it.`;
  if (r.goesTo === "space") {
    return `${hidden}The Space's moderators will look at it${r.hidden ? " and decide" : ""}.`;
  }
  if (kind === "post" || kind === "comment") {
    return r.hidden
      ? "It's hidden now: enough people reported it."
      : `It's on record. If a few more people report it, it hides on its own. Blocking them stops you seeing what they post.`;
  }
  return "It's on record. Blocking them stops them reaching you, straight away.";
}

const s = StyleSheet.create({
  fill: { flex: 1 },
  body: { padding: 20, gap: 4 },
  title: {
    fontFamily: fonts.displayBold,
    fontSize: 24,
    lineHeight: 29,
    color: roles.text,
    letterSpacing: -0.3,
  },
  lead: {
    fontFamily: fonts.body,
    fontSize: 16,
    lineHeight: 24,
    color: roles.textSoft,
    marginTop: 6,
  },
  reasons: { marginTop: 18, marginBottom: 22, gap: 8 },
  reason: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 54,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: roles.border,
  },
  reasonOn: { borderColor: roles.text, backgroundColor: roles.surfaceRaised },
  pressed: { backgroundColor: roles.surfaceRaised },
  reasonText: { flex: 1, fontFamily: fonts.bold, fontSize: 15.5, color: roles.text },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: roles.borderStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  radioOn: { borderColor: roles.text },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: roles.text },
  details: { minHeight: 96, textAlignVertical: "top", paddingTop: 14 },
  send: { marginTop: 24, gap: 14 },
  doneMark: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: roles.surfaceRaised,
    marginBottom: 14,
  },
  doneActions: { marginTop: 28, gap: 10 },
});
