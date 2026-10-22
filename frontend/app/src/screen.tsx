import type { ReactNode } from "react";
import { KeyboardAvoidingView, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LightField } from "./light-field";
import { type NativeTheme, useStyles } from "./theme";
import { BackButton } from "./ui";

/**
 * An account screen: the lit ground, a back control, and a scrolling column that keeps the
 * focused field above the keyboard (edge to edge, under the system bars).
 */
export function FormScreen({ children, back = true }: { children: ReactNode; back?: boolean }) {
  const s = useStyles(make);
  const insets = useSafeAreaInsets();
  return (
    <View style={s.screen}>
      <LightField />
      <KeyboardAvoidingView behavior="padding" style={s.fill}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[
            s.content,
            { paddingTop: insets.top + 6, paddingBottom: insets.bottom + 28 },
          ]}
        >
          {back ? <BackButton /> : null}
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const make = (t: NativeTheme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.colors.bg },
    fill: { flex: 1 },
    content: { flexGrow: 1, paddingHorizontal: 24 },
  });
