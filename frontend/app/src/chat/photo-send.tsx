import { Image } from "expo-image";
import { useEffect, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon } from "../icon";
import { type NativeTheme, useStyles, useTheme } from "../theme";

export type Picked = { uri: string; width: number; height: number; mimeType?: string | null };
export type Keep = "keep" | 1 | 2;

const KEEPS: { id: Keep; label: string; line: string }[] = [
  { id: 1, label: "View once", line: "They can open it once. It closes after 10 seconds." },
  { id: 2, label: "Allow replay", line: "They can open it twice, then it's gone." },
  { id: "keep", label: "Keep in chat", line: "It stays in the chat like any photo." },
];

/**
 * Before photos go: see them big, add a caption, and choose how long they last: view once,
 * allow one replay, or keep in the chat. (Screenshots of view-once photos are blocked, and the
 * sender told, once the next app build is installed.)
 */
export function PhotoSend({
  photos,
  caption,
  canLimit,
  onCancel,
  onSend,
}: {
  photos: Picked[] | null;
  caption: string;
  /** View once is for conversations; Space rooms keep photos. */
  canLimit: boolean;
  onCancel: () => void;
  onSend: (photos: Picked[], caption: string, viewLimit: 1 | 2 | undefined) => void;
}) {
  const { t, accent, onAccent } = useTheme();
  const s = useStyles(make);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [text, setText] = useState(caption);
  const [keep, setKeep] = useState<Keep>("keep");
  const [index, setIndex] = useState(0);
  const [list, setList] = useState<Picked[]>([]);

  useEffect(() => {
    if (!photos) return;
    setList(photos);
    setText(caption);
    setIndex(0);
    setKeep("keep");
  }, [photos, caption]);

  const send = () => {
    if (!list.length) return;
    onSend(list, text.trim(), keep === "keep" ? undefined : keep);
  };
  const remove = (i: number) => {
    const next = list.filter((_, j) => j !== i);
    if (!next.length) return onCancel();
    setList(next);
    setIndex(Math.min(index, next.length - 1));
  };

  return (
    <Modal
      visible={photos !== null}
      animationType="slide"
      onRequestClose={onCancel}
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={[s.root, { paddingTop: insets.top + 6, paddingBottom: insets.bottom + 10 }]}
      >
        <View style={s.head}>
          <Pressable
            onPress={onCancel}
            accessibilityRole="button"
            accessibilityLabel="Cancel"
            style={s.icon}
          >
            <Icon name="X" size={24} color="#ffffff" />
          </Pressable>
          <Text style={s.headText}>
            {list.length > 1 ? `${index + 1} of ${list.length}` : "Photo"}
          </Text>
          {list.length > 1 ? (
            <Pressable
              onPress={() => remove(index)}
              accessibilityRole="button"
              accessibilityLabel="Remove this photo"
              style={s.icon}
            >
              <Icon name="Trash" size={22} color="#ffffff" />
            </Pressable>
          ) : (
            <View style={s.icon} />
          )}
        </View>

        <FlatList
          data={list}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          keyExtractor={(p) => p.uri}
          onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
          style={s.fill}
          renderItem={({ item }) => (
            <View style={{ width, flex: 1, justifyContent: "center" }}>
              <Image source={{ uri: item.uri }} style={s.photo} contentFit="contain" />
            </View>
          )}
        />

        {canLimit ? (
          <View style={s.keeps} accessibilityRole="radiogroup">
            {KEEPS.map((k) => {
              const on = keep === k.id;
              return (
                <Pressable
                  key={String(k.id)}
                  onPress={() => setKeep(k.id)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on }}
                  accessibilityHint={k.line}
                  style={[s.keep, on && { backgroundColor: "#ffffff", borderColor: "#ffffff" }]}
                >
                  {k.id !== "keep" ? (
                    <View style={[s.once, on && { borderColor: "#000000" }]}>
                      <Text style={[s.onceText, on && { color: "#000000" }]}>{k.id}</Text>
                    </View>
                  ) : null}
                  <Text style={[s.keepText, on && { color: "#000000" }]}>{k.label}</Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}
        {canLimit ? <Text style={s.keepLine}>{KEEPS.find((k) => k.id === keep)?.line}</Text> : null}

        <View style={s.bottom}>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Add a caption…"
            placeholderTextColor="rgba(255,255,255,0.55)"
            selectionColor={accent}
            cursorColor={accent}
            maxLength={4000}
            style={s.caption}
            accessibilityLabel="Caption"
            onSubmitEditing={send}
          />
          <Pressable
            onPress={send}
            accessibilityRole="button"
            accessibilityLabel={
              keep === 1 ? "Send to view once" : keep === 2 ? "Send, allow one replay" : "Send"
            }
            style={[s.send, { backgroundColor: accent }]}
          >
            <Icon name="ArrowUpBold" size={22} color={onAccent} />
          </Pressable>
        </View>
        <Text style={[s.small, { color: t.colors.textMuted }]}>
          {list.length} {list.length === 1 ? "photo" : "photos"}
        </Text>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const make = (t: NativeTheme) =>
  StyleSheet.create({
    fill: { flex: 1 },
    root: { flex: 1, backgroundColor: "#000000" },
    head: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 8,
    },
    headText: { fontFamily: t.fonts.bold, fontSize: 16 * t.textScale, color: "#ffffff" },
    icon: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
    photo: { width: "100%", height: "100%" },
    keeps: { flexDirection: "row", justifyContent: "center", gap: 8, paddingTop: 12 },
    keep: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      minHeight: 38,
      paddingHorizontal: 14,
      borderRadius: 999,
      borderWidth: 1.5,
      borderColor: "rgba(255,255,255,0.4)",
    },
    keepText: { fontFamily: t.fonts.bold, fontSize: 13.5 * t.textScale, color: "#ffffff" },
    once: {
      width: 20,
      height: 20,
      borderRadius: 10,
      borderWidth: 1.5,
      borderStyle: "dashed",
      borderColor: "#ffffff",
      alignItems: "center",
      justifyContent: "center",
    },
    onceText: { fontFamily: t.fonts.bold, fontSize: 11 * t.textScale, color: "#ffffff" },
    keepLine: {
      fontFamily: t.fonts.body,
      fontSize: 13 * t.textScale,
      color: "rgba(255,255,255,0.7)",
      textAlign: "center",
      marginTop: 8,
      paddingHorizontal: 20,
    },
    bottom: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 12,
      marginTop: 12,
    },
    caption: {
      flex: 1,
      minWidth: 0,
      minHeight: 46,
      borderRadius: 23,
      paddingHorizontal: 16,
      backgroundColor: "rgba(255,255,255,0.12)",
      fontFamily: t.fonts.body,
      fontSize: 15.5 * t.textScale,
      color: "#ffffff",
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
      fontSize: 12 * t.textScale,
      textAlign: "center",
      marginTop: 6,
    },
  });
