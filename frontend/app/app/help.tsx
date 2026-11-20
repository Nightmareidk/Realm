import type { HelpAnswer } from "@realm/contracts";
import { LinearGradient } from "expo-linear-gradient";
import { type Href, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon } from "@/icon";
import { ApiError, api } from "@/server";
import { AppScreen, TopBar } from "@/social/screen";
import { type NativeTheme, useStyles, useTheme } from "@/theme";

/**
 * "Ask Realm": a small help chat for basic questions. TEMPORARY (course project). The answers come
 * from a fixed list on Realm's server (no AI service); questions aren't saved. To take it out,
 * delete this file and the "Help" row in app/settings.tsx.
 */
type Line =
  | { from: "you"; text: string; id: number }
  | { from: "realm"; answer: HelpAnswer; id: number };

const HELLO: HelpAnswer = {
  answer:
    "Hi! I'm Realm's little helper. Ask me how to do something, like changing your theme or turning on notifications.",
  link: null,
  suggestions: [],
};

/** Only Realm's own screens open from an answer: a plain path, nothing else. */
const SAFE_PATH = /^\/[a-z0-9/-]{0,60}$/;

export default function Help() {
  const { t, accent, onAccent } = useTheme();
  const s = useStyles(make);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [lines, setLines] = useState<Line[]>([{ from: "realm", answer: HELLO, id: 0 }]);
  const [starters, setStarters] = useState<string[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");
  const next = useRef(1);
  const list = useRef<FlatList<Line>>(null);

  useEffect(() => {
    api<{ suggestions: string[] }>("/help/starters")
      .then((r) => setStarters(r.suggestions))
      .catch(() => {});
  }, []);

  async function ask(question: string) {
    const q = question.trim().slice(0, 300);
    if (!q || busy) return;
    setProblem("");
    setBusy(true);
    setText("");
    setLines((l) => [...l, { from: "you", text: q, id: next.current++ }]);
    try {
      const answer = await api<HelpAnswer>("/help/ask", { method: "POST", body: { question: q } });
      setLines((l) => [...l, { from: "realm", answer, id: next.current++ }]);
    } catch (err) {
      setProblem(
        err instanceof ApiError && err.status === 429
          ? "That's a lot of questions! Wait a minute, then ask again."
          : "Couldn't get an answer. Check your connection and try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  const last = lines.at(-1);
  const chips =
    last?.from === "realm" && last.answer.suggestions.length > 0
      ? last.answer.suggestions
      : lines.length === 1
        ? starters
        : [];
  const canSend = text.trim().length > 0 && !busy;

  return (
    <AppScreen>
      <TopBar title="Ask Realm" />
      <KeyboardAvoidingView behavior="padding" style={s.fill}>
        <FlatList
          ref={list}
          data={lines}
          keyExtractor={(l) => String(l.id)}
          contentContainerStyle={s.log}
          accessibilityLabel="Conversation with Realm's helper"
          onContentSizeChange={() => list.current?.scrollToEnd({ animated: true })}
          ListHeaderComponent={
            <Text style={s.small}>
              Answers come from a fixed list in Realm. Your questions aren't saved.
            </Text>
          }
          renderItem={({ item }) =>
            item.from === "you" ? (
              <View style={[s.mine, { backgroundColor: accent }]}>
                {t.colors.gradient ? (
                  <LinearGradient
                    colors={[accent, t.colors.accent2]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[StyleSheet.absoluteFill, s.mineShape]}
                  />
                ) : null}
                <Text
                  style={[s.mineText, { color: onAccent }]}
                  accessibilityLabel={`You: ${item.text}`}
                >
                  {item.text}
                </Text>
              </View>
            ) : (
              <View style={s.theirsRow}>
                <View style={s.avatar}>
                  <Icon name="SparkleFill" size={16} color={t.colors.text} />
                </View>
                <View style={s.theirs} accessibilityLiveRegion="polite">
                  <Text style={s.theirsText} accessibilityLabel={`Realm: ${item.answer.answer}`}>
                    {item.answer.answer}
                  </Text>
                  {item.answer.link?.app && SAFE_PATH.test(item.answer.link.app) ? (
                    <Pressable
                      accessibilityRole="link"
                      onPress={() => router.push(item.answer.link?.app as Href)}
                      hitSlop={8}
                      style={s.linkRow}
                    >
                      <Text style={s.link}>{item.answer.link.label}</Text>
                      <Icon name="CaretRight" size={15} color={t.colors.text} />
                    </Pressable>
                  ) : null}
                </View>
              </View>
            )
          }
          ListFooterComponent={
            <>
              {busy ? (
                <Text style={s.thinking} accessibilityLiveRegion="polite">
                  Thinking…
                </Text>
              ) : null}
              {problem ? (
                <Text style={s.problem} accessibilityLiveRegion="polite">
                  {problem}
                </Text>
              ) : null}
            </>
          }
        />

        {chips.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.chips}
            accessibilityLabel="Questions you can ask"
            keyboardShouldPersistTaps="handled"
          >
            {chips.map((c) => (
              <Pressable
                key={c}
                onPress={() => void ask(c)}
                disabled={busy}
                accessibilityRole="button"
                style={({ pressed }) => [s.chip, pressed && s.chipPressed, busy && s.dim]}
              >
                <Text style={s.chipText}>{c}</Text>
              </Pressable>
            ))}
          </ScrollView>
        ) : null}

        <View style={[s.composer, { paddingBottom: insets.bottom + 8 }]}>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Ask how to do something"
            placeholderTextColor={t.colors.textMuted}
            selectionColor={accent}
            cursorColor={accent}
            maxLength={300}
            returnKeyType="send"
            submitBehavior="submit"
            onSubmitEditing={() => void ask(text)}
            style={s.input}
            accessibilityLabel="Your question"
          />
          <Pressable
            onPress={() => void ask(text)}
            disabled={!canSend}
            accessibilityRole="button"
            accessibilityLabel="Ask"
            accessibilityState={{ disabled: !canSend }}
            style={[s.send, { backgroundColor: accent }, !canSend && s.dim]}
          >
            <Icon name="ArrowUpBold" size={20} color={onAccent} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </AppScreen>
  );
}

const make = (t: NativeTheme) =>
  StyleSheet.create({
    fill: { flex: 1 },
    log: { padding: 16, gap: 12 },
    mine: {
      alignSelf: "flex-end",
      maxWidth: "80%",
      borderRadius: 18,
      borderBottomRightRadius: 6,
      paddingHorizontal: 14,
      paddingVertical: 9,
      overflow: "hidden",
    },
    mineShape: { borderRadius: 18, borderBottomRightRadius: 6 },
    mineText: {
      fontFamily: t.fonts.body,
      fontSize: 15.5 * t.textScale,
      lineHeight: 22 * t.textScale,
    },
    theirsRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, maxWidth: "88%" },
    avatar: {
      width: 32,
      height: 32,
      borderRadius: 16,
      marginTop: 2,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: t.colors.surfaceRaised,
    },
    theirs: {
      flexShrink: 1,
      gap: 8,
      borderRadius: 18,
      borderTopLeftRadius: 6,
      paddingHorizontal: 14,
      paddingVertical: 10,
      backgroundColor: t.colors.surfaceRaised,
    },
    theirsText: {
      fontFamily: t.fonts.body,
      fontSize: 15.5 * t.textScale,
      lineHeight: 22 * t.textScale,
      color: t.colors.text,
    },
    linkRow: { flexDirection: "row", alignItems: "center", gap: 4, minHeight: 32 },
    link: {
      fontFamily: t.fonts.bold,
      fontSize: 15 * t.textScale,
      color: t.colors.text,
      textDecorationLine: "underline",
    },
    thinking: {
      fontFamily: t.fonts.body,
      fontSize: 14 * t.textScale,
      color: t.colors.textSoft,
      paddingLeft: 42,
      marginTop: 12,
    },
    problem: {
      fontFamily: t.fonts.bold,
      fontSize: 14 * t.textScale,
      color: t.colors.danger,
      marginTop: 12,
    },
    chips: { gap: 8, paddingHorizontal: 16, paddingBottom: 10 },
    chip: {
      minHeight: 40,
      justifyContent: "center",
      paddingHorizontal: 14,
      borderRadius: 999,
      borderWidth: 1.5,
      borderColor: t.colors.borderStrong,
    },
    chipPressed: { backgroundColor: t.colors.surfaceRaised },
    chipText: { fontFamily: t.fonts.bold, fontSize: 14 * t.textScale, color: t.colors.text },
    dim: { opacity: 0.45 },
    composer: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 12,
      paddingTop: 8,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: t.colors.border,
      backgroundColor: t.colors.bg,
    },
    input: {
      flex: 1,
      minWidth: 0,
      height: 46,
      borderRadius: 23,
      borderWidth: 1.5,
      borderColor: t.colors.borderStrong,
      backgroundColor: t.colors.surfaceSunken,
      paddingHorizontal: 16,
      fontFamily: t.fonts.body,
      fontSize: 16 * t.textScale,
      color: t.colors.text,
    },
    send: {
      width: 46,
      height: 46,
      borderRadius: 23,
      alignItems: "center",
      justifyContent: "center",
    },
    small: {
      fontFamily: t.fonts.body,
      fontSize: 12.5 * t.textScale,
      color: t.colors.textSoft,
      textAlign: "center",
      marginBottom: 4,
    },
  });
