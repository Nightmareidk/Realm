import type { MyVerification } from "@realm/contracts";
import { type ComponentProps, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useApi } from "@/data";
import { Icon } from "@/icon";
import { ApiError, api } from "@/server";
import { AppScreen, Loading, Problem, TopBar } from "@/social/screen";
import { agoLong } from "@/social/time";
import { Verified } from "@/social/verified";
import { type NativeTheme, useStyles, useTheme } from "@/theme";
import { Pill } from "@/ui";

type Kind = "notable" | "business";

/**
 * Asking to be verified. The badge is for notable people (artists, creators, athletes, public
 * figures) and real businesses and brands, people others might pretend to be. Staff check the
 * links against the name; a verified account can also be given its famous name if it's kept back.
 */
export default function Verification() {
  const { t, accent } = useTheme();
  const s = useStyles(make);
  const mine = useApi<MyVerification>("/users/@me/verification");
  const [kind, setKind] = useState<Kind>("notable");
  const [realName, setRealName] = useState("");
  const [category, setCategory] = useState("");
  const [links, setLinks] = useState(["", "", ""]);
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    const clean = links.map((l) => l.trim()).filter(Boolean);
    if (realName.trim().length < 2) return setError("Add the name people know you by.");
    if (category.trim().length < 2) return setError("Say what you are, like “Musician” or “Cafe”.");
    if (!clean.length) return setError("Add at least one link where people already know you.");
    if (clean.some((l) => !/^https:\/\/\S+\.\S+/.test(l))) {
      return setError("Links need to be full https:// addresses.");
    }
    setError(null);
    setSending(true);
    try {
      mine.setData(
        await api<MyVerification>("/users/@me/verification", {
          body: {
            kind,
            realName: realName.trim(),
            category: category.trim(),
            links: clean,
            note: note.trim() || undefined,
          },
        }),
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "That didn't go through. Try again.");
    } finally {
      setSending(false);
    }
  }

  const field = (
    label: string,
    value: string,
    set: (v: string) => void,
    placeholder: string,
    extra: Partial<ComponentProps<typeof TextInput>> = {},
  ) => (
    <>
      <Text style={s.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={set}
        placeholder={placeholder}
        placeholderTextColor={t.colors.textMuted}
        selectionColor={accent}
        cursorColor={accent}
        style={s.input}
        accessibilityLabel={label}
        {...extra}
      />
    </>
  );

  return (
    <AppScreen>
      <TopBar title="Verification" />
      {mine.error && !mine.data ? (
        <Problem message={mine.error} onRetry={mine.reload} />
      ) : !mine.data ? (
        <Loading />
      ) : mine.data.verified ? (
        <View style={s.done}>
          <Verified kind={mine.data.verified} size={56} />
          <Text style={s.doneTitle}>You're verified</Text>
          <Text style={s.doneLine}>
            Your badge shows next to your name on your profile, posts, comments and messages.
          </Text>
        </View>
      ) : mine.data.request?.status === "pending" ? (
        <View style={s.done}>
          <Icon name="SealCheckFill" size={56} color={t.colors.textSoft} />
          <Text style={s.doneTitle}>We're looking at it</Text>
          <Text style={s.doneLine}>
            You asked {agoLong(mine.data.request.createdAt)}. We check the links against the name
            and let you know here.
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
          <Verified kind="notable" size={40} />
          <Text style={s.title}>Get the badge</Text>
          <Text style={s.lead}>
            For notable people and real businesses, the accounts others might pretend to be. It
            shows people it's really you, and keeps your name for you.
          </Text>
          {mine.data.request?.status === "rejected" ? (
            <View style={s.rejected}>
              <Text style={s.rejectedTitle}>Last time it was a no</Text>
              <Text style={s.rejectedLine}>
                {mine.data.request.reason ?? "We couldn't confirm it from the links."}{" "}
                {mine.data.canApply
                  ? "You can ask again."
                  : "You can ask again a month after the answer."}
              </Text>
            </View>
          ) : null}

          {mine.data.canApply ? (
            <>
              <Text style={s.label}>You are</Text>
              <View style={s.kinds} accessibilityRole="radiogroup">
                {(
                  [
                    ["notable", "A notable person", "Artist, creator, athlete, public figure"],
                    ["business", "A business or brand", "A company, shop, team or group"],
                  ] as const
                ).map(([id, title, line]) => (
                  <Pressable
                    key={id}
                    onPress={() => setKind(id)}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: kind === id }}
                    style={[s.kind, kind === id && { borderColor: accent }]}
                  >
                    <View style={[s.dot, kind === id && { borderColor: accent }]}>
                      {kind === id ? <View style={[s.dotOn, { backgroundColor: accent }]} /> : null}
                    </View>
                    <View style={s.fill}>
                      <Text style={s.kindTitle}>{title}</Text>
                      <Text style={s.kindLine}>{line}</Text>
                    </View>
                  </Pressable>
                ))}
              </View>
              {field(
                kind === "business" ? "Business name" : "The name people know you by",
                realName,
                setRealName,
                kind === "business" ? "Realm Coffee Co." : "Sabrina Carpenter",
                { maxLength: 80 },
              )}
              {field("Category", category, setCategory, kind === "business" ? "Cafe" : "Musician", {
                maxLength: 40,
              })}
              <Text style={s.label}>Where people already know you</Text>
              <Text style={s.hint}>
                Your official site, your verified accounts elsewhere, or news about you. Full
                https:// links.
              </Text>
              {links.map((l, i) => (
                <TextInput
                  // biome-ignore lint/suspicious/noArrayIndexKey: a short fixed list of fields
                  key={i}
                  value={l}
                  onChangeText={(v) => setLinks(links.map((x, j) => (j === i ? v : x)))}
                  placeholder="https://"
                  placeholderTextColor={t.colors.textMuted}
                  selectionColor={accent}
                  cursorColor={accent}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                  maxLength={300}
                  style={[s.input, s.link]}
                  accessibilityLabel={`Link ${i + 1}`}
                />
              ))}
              {links.length < 5 ? (
                <Pressable
                  onPress={() => setLinks([...links, ""])}
                  accessibilityRole="button"
                  hitSlop={6}
                >
                  <Text style={s.more}>Add another link</Text>
                </Pressable>
              ) : null}
              {field("Anything else (optional)", note, setNote, "Who you are, in a line or two", {
                multiline: true,
                maxLength: 500,
              })}
              {error ? <Text style={s.error}>{error}</Text> : null}
              <Pill
                label="Ask to be verified"
                pending={sending}
                pendingLabel="Sending"
                onPress={send}
              />
              <Text style={s.small}>
                We never ask for your password or an ID photo here. Staff may message you from
                @realm to check.
              </Text>
            </>
          ) : null}
        </ScrollView>
      )}
    </AppScreen>
  );
}

const make = (t: NativeTheme) =>
  StyleSheet.create({
    fill: { flex: 1 },
    body: { padding: 20, paddingBottom: 60 },
    title: {
      fontFamily: t.fonts.display,
      fontSize: 28 * t.textScale,
      color: t.colors.heading,
      marginTop: 12,
    },
    lead: {
      fontFamily: t.fonts.body,
      fontSize: 15.5 * t.textScale,
      lineHeight: 22 * t.textScale,
      color: t.colors.textSoft,
      marginTop: 6,
    },
    label: {
      fontFamily: t.fonts.bold,
      fontSize: 15 * t.textScale,
      color: t.colors.text,
      marginTop: 22,
      marginBottom: 8,
    },
    hint: {
      fontFamily: t.fonts.body,
      fontSize: 13.5 * t.textScale,
      color: t.colors.textSoft,
      marginTop: -4,
      marginBottom: 8,
    },
    input: {
      minHeight: 48,
      borderRadius: t.radius.input,
      borderWidth: 1.5,
      borderColor: t.colors.borderStrong,
      paddingHorizontal: 14,
      paddingVertical: 10,
      fontFamily: t.fonts.body,
      fontSize: 16 * t.textScale,
      color: t.colors.text,
    },
    link: { marginBottom: 8 },
    more: {
      fontFamily: t.fonts.bold,
      fontSize: 14.5 * t.textScale,
      color: t.colors.link,
      paddingVertical: 6,
    },
    kinds: { gap: 8 },
    kind: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      padding: 14,
      borderRadius: t.radius.card,
      borderWidth: 1.5,
      borderColor: t.colors.border,
      backgroundColor: t.colors.surface,
    },
    kindTitle: { fontFamily: t.fonts.bold, fontSize: 15.5 * t.textScale, color: t.colors.text },
    kindLine: {
      fontFamily: t.fonts.body,
      fontSize: 13.5 * t.textScale,
      color: t.colors.textSoft,
      marginTop: 2,
    },
    dot: {
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 2,
      borderColor: t.colors.borderStrong,
      alignItems: "center",
      justifyContent: "center",
    },
    dotOn: { width: 10, height: 10, borderRadius: 5 },
    error: {
      fontFamily: t.fonts.bold,
      fontSize: 14.5 * t.textScale,
      color: t.colors.danger,
      marginVertical: 12,
    },
    small: {
      fontFamily: t.fonts.body,
      fontSize: 12.5 * t.textScale,
      color: t.colors.textSoft,
      marginTop: 14,
      lineHeight: 18 * t.textScale,
    },
    rejected: {
      marginTop: 18,
      padding: 14,
      borderRadius: t.radius.card,
      backgroundColor: t.colors.surface,
      borderWidth: 1,
      borderColor: t.colors.border,
    },
    rejectedTitle: { fontFamily: t.fonts.bold, fontSize: 15 * t.textScale, color: t.colors.text },
    rejectedLine: {
      fontFamily: t.fonts.body,
      fontSize: 14 * t.textScale,
      color: t.colors.textSoft,
      marginTop: 4,
    },
    done: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 10 },
    doneTitle: { fontFamily: t.fonts.display, fontSize: 24 * t.textScale, color: t.colors.heading },
    doneLine: {
      fontFamily: t.fonts.body,
      fontSize: 15 * t.textScale,
      lineHeight: 22 * t.textScale,
      color: t.colors.textSoft,
      textAlign: "center",
    },
  });
