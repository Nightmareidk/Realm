import {
  Permission,
  type ReportedItem,
  type ReportReason,
  type SpaceDetail,
} from "@realm/contracts";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { alert } from "../alert";
import { useApi } from "../data";
import { Icon } from "../icon";
import { ApiError, api } from "../server";
import { Avatar } from "../social/avatar";
import { Loading, Problem } from "../social/screen";
import { agoLong } from "../social/time";
import { type NativeTheme, useStyles, useTheme } from "../theme";
import { Pill } from "../ui";
import { powerIn } from "./power";

const REASONS: Record<ReportReason, string> = {
  spam: "Spam or a scam",
  harassment: "Bullying",
  hate: "Hate",
  sexual_content: "Sexual content",
  sexual_minors: "Involves a minor",
  violence: "Threats or violence",
  self_harm: "Self-harm",
  impersonation: "Pretending to be someone",
  intellectual_property: "Someone else's work",
  other: "Something else",
};

const KIND: Record<ReportedItem["targetType"], string> = {
  message: "A message",
  post: "A post",
  comment: "A comment",
  user: "A member",
  community: "The Space",
};

/**
 * What members reported here, most-reported first, for the Space's moderators. Each one can be
 * let go ("Nothing wrong", which also shows it again if reports hid it) or taken down, and the
 * person who wrote it can be timed out for a day or banned in the same place.
 */
export function Reports({ space }: { space: SpaceDetail }) {
  const { t } = useTheme();
  const s = useStyles(make);
  const power = powerIn(space);
  const queue = useApi<{ items: ReportedItem[] }>(`/communities/${space.id}/reports`);

  async function run(what: string, fn: () => Promise<unknown>) {
    try {
      await fn();
      queue.reload();
    } catch (err) {
      alert(`Couldn't ${what}`, err instanceof ApiError ? err.message : "Try again.");
    }
  }
  const decide = (item: ReportedItem, action: "dismiss" | "remove") =>
    run(action === "dismiss" ? "let it go" : "take it down", () =>
      api(`/communities/${space.id}/reports/${item.targetId}`, { body: { action } }),
    );

  function author(item: ReportedItem) {
    const who = item.evidence?.author;
    if (!who) return;
    alert(`What about ${who.displayName}?`, 'It goes in the audit log as "After reports".', [
      { text: "Nothing for now", style: "cancel" },
      ...(power.can(Permission.TIMEOUT_MEMBERS)
        ? [
            {
              text: "Time out for a day",
              onPress: () =>
                run("time them out", () =>
                  api(`/communities/${space.id}/members/${who.id}`, {
                    method: "PATCH",
                    body: {
                      timeoutUntil: new Date(Date.now() + 86_400_000).toISOString(),
                      reason: "After reports",
                    },
                  }),
                ),
            },
          ]
        : []),
      ...(power.can(Permission.BAN_MEMBERS)
        ? [
            {
              text: "Ban and delete their last day",
              style: "destructive" as const,
              onPress: () =>
                run("ban them", () =>
                  api(`/communities/${space.id}/bans/${who.id}`, {
                    method: "PUT",
                    body: { reason: "After reports", deleteMessagesHours: 24 },
                  }),
                ),
            },
          ]
        : []),
    ]);
  }

  if (queue.error && !queue.data) return <Problem message={queue.error} onRetry={queue.reload} />;
  if (!queue.data) return <Loading />;
  const items = queue.data.items;
  return (
    <ScrollView contentContainerStyle={s.pad}>
      {items.length === 0 ? (
        <View style={s.clear}>
          <Icon name="ShieldCheck" size={40} color={t.colors.accent} />
          <Text style={s.clearTitle}>All clear</Text>
          <Text style={[s.lead, s.center]}>
            Nothing is waiting. When members report something here, it shows up for you and the
            other moderators.
          </Text>
        </View>
      ) : (
        <Text style={s.lead}>
          {items.length} {items.length === 1 ? "thing" : "things"} to look at. Messages hide on
          their own after a few reports, until a moderator decides.
        </Text>
      )}
      {items.map((item) => {
        const who = item.evidence?.author;
        const removable = item.targetType !== "user" && item.targetType !== "community";
        return (
          <View key={`${item.targetType}:${item.targetId}`} style={s.card}>
            <View style={s.top}>
              <Text style={s.kind}>{KIND[item.targetType]}</Text>
              <Text style={s.count}>
                {item.count} {item.count === 1 ? "report" : "reports"} ·{" "}
                {agoLong(item.firstReportedAt)}
              </Text>
            </View>
            {item.evidence ? (
              <View style={s.evidence}>
                {who ? (
                  <View style={s.who}>
                    <Avatar user={who} size={26} />
                    <Text style={s.whoName} numberOfLines={1}>
                      {who.displayName}
                    </Text>
                  </View>
                ) : null}
                <Text style={s.content} numberOfLines={6}>
                  {item.evidence.content || "(a photo or file, no words)"}
                </Text>
              </View>
            ) : null}
            <View style={s.reasons}>
              {item.reasons.map((r) => (
                <View key={r} style={s.reason}>
                  <Text style={s.reasonText}>{REASONS[r]}</Text>
                </View>
              ))}
              {item.hidden ? (
                <View style={[s.reason, s.hidden]}>
                  <Icon name="EyeSlash" size={12} color={t.colors.danger} />
                  <Text style={[s.reasonText, { color: t.colors.danger }]}>Hidden for now</Text>
                </View>
              ) : null}
            </View>
            {item.details.length ? (
              <Text style={s.details} numberOfLines={3}>
                "{item.details.join('" · "')}"
              </Text>
            ) : null}
            <View style={s.actions}>
              <Pill
                size="md"
                kind="ghost"
                label="Nothing wrong"
                style={s.grow}
                onPress={() => decide(item, "dismiss")}
              />
              {removable ? (
                <Pill
                  size="md"
                  label="Take it down"
                  style={s.grow}
                  onPress={() => decide(item, "remove")}
                />
              ) : null}
            </View>
            {who &&
            who.id !== space.ownerId &&
            (power.can(Permission.TIMEOUT_MEMBERS) || power.can(Permission.BAN_MEMBERS)) ? (
              <Pill
                size="sm"
                kind="quiet"
                label={`Deal with ${who.displayName}`}
                onPress={() => author(item)}
              />
            ) : null}
          </View>
        );
      })}
    </ScrollView>
  );
}

const make = (t: NativeTheme) =>
  StyleSheet.create({
    pad: { padding: 16, gap: 12, paddingBottom: 120 },
    lead: {
      fontFamily: t.fonts.body,
      fontSize: 14.5 * t.textScale,
      lineHeight: 21 * t.textScale,
      color: t.colors.textSoft,
      textAlign: "left",
    },
    clear: { alignItems: "center", gap: 8, paddingVertical: 40, paddingHorizontal: 20 },
    clearTitle: {
      fontFamily: t.fonts.display,
      fontSize: 24 * t.textScale,
      color: t.colors.heading,
    },
    card: {
      padding: 14,
      gap: 10,
      borderRadius: t.radius.card,
      borderWidth: 1,
      borderColor: t.colors.border,
      backgroundColor: t.colors.surface,
    },
    top: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
    kind: { fontFamily: t.fonts.bold, fontSize: 14.5 * t.textScale, color: t.colors.text },
    count: { fontFamily: t.fonts.body, fontSize: 12.5 * t.textScale, color: t.colors.textSoft },
    evidence: {
      gap: 6,
      padding: 12,
      borderRadius: t.radius.input,
      backgroundColor: t.colors.surfaceRaised,
      borderLeftWidth: 3,
      borderLeftColor: t.colors.dangerLine,
    },
    who: { flexDirection: "row", alignItems: "center", gap: 8 },
    whoName: { fontFamily: t.fonts.bold, fontSize: 14 * t.textScale, color: t.colors.text },
    content: {
      fontFamily: t.fonts.body,
      fontSize: 15 * t.textScale,
      lineHeight: 21 * t.textScale,
      color: t.colors.text,
    },
    reasons: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
    reason: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingHorizontal: 9,
      height: 24,
      borderRadius: 12,
      backgroundColor: t.colors.surfaceRaised,
    },
    hidden: { borderWidth: 1, borderColor: t.colors.dangerLine, backgroundColor: "transparent" },
    reasonText: { fontFamily: t.fonts.bold, fontSize: 12 * t.textScale, color: t.colors.text },
    details: {
      fontFamily: t.fonts.body,
      fontSize: 13.5 * t.textScale,
      color: t.colors.textSoft,
      fontStyle: "italic",
    },
    actions: { flexDirection: "row", gap: 8 },
    grow: { flex: 1 },
    center: { textAlign: "center" },
  });
