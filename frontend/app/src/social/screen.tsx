import { useRouter } from "expo-router";
import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon } from "../icon";
import { LightField } from "../light-field";
import { fonts, roles } from "../theme";

/**
 * A signed-in screen: the ink ground with the light field held faint (the app leads, not the
 * glow), under the status bar. Tab screens leave the bottom to the tab bar.
 */
export function AppScreen({ children }: { children: ReactNode }) {
  return (
    <View style={s.screen}>
      <View style={s.dim} pointerEvents="none">
        <LightField />
      </View>
      {children}
    </View>
  );
}

/** A pushed screen's top bar: back, a title, and room for one action on the right. */
export function TopBar({ title, right }: { title?: string; right?: ReactNode }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  return (
    <View style={[s.top, { paddingTop: insets.top + 4 }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back"
        onPress={() => (router.canGoBack() ? router.back() : router.replace("/home"))}
        style={s.icon}
      >
        <Icon name="CaretLeft" size={24} color={roles.text} />
      </Pressable>
      <Text style={s.title} numberOfLines={1} accessibilityRole="header">
        {title ?? ""}
      </Text>
      <View style={s.right}>{right}</View>
    </View>
  );
}

export function Loading() {
  return (
    <View style={s.center}>
      <ActivityIndicator color={roles.textSoft} />
    </View>
  );
}

/** Say what's missing and what to do about it; never an illustration (DESIGN.md EmptyState). */
export function Empty({
  title,
  line,
  children,
}: {
  title: string;
  line?: string;
  children?: ReactNode;
}) {
  return (
    <View style={s.empty}>
      <Text style={s.emptyTitle} accessibilityRole="header">
        {title}
      </Text>
      {line ? <Text style={s.emptyLine}>{line}</Text> : null}
      {children ? <View style={s.emptyActions}>{children}</View> : null}
    </View>
  );
}

export function Problem({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <View style={s.empty}>
      <Text style={s.emptyLine}>{message}</Text>
      <Pressable onPress={onRetry} accessibilityRole="button" style={s.retry}>
        <Text style={s.retryText}>Try again</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: roles.bg },
  dim: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, opacity: 0.38 },
  top: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 4,
    paddingBottom: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: roles.border,
    backgroundColor: roles.bg,
  },
  icon: { width: 48, height: 48, alignItems: "center", justifyContent: "center" },
  title: { flex: 1, fontFamily: fonts.displayBold, fontSize: 19, color: roles.text },
  right: { minWidth: 48, alignItems: "flex-end", paddingRight: 8 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 40 },
  empty: { paddingHorizontal: 28, paddingVertical: 48, alignItems: "center" },
  emptyTitle: {
    fontFamily: fonts.displayBold,
    fontSize: 22,
    color: roles.text,
    textAlign: "center",
  },
  emptyLine: {
    fontFamily: fonts.body,
    fontSize: 16,
    lineHeight: 24,
    color: roles.textSoft,
    textAlign: "center",
    marginTop: 8,
    maxWidth: 320,
  },
  emptyActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 20,
    justifyContent: "center",
  },
  retry: { minHeight: 48, justifyContent: "center", marginTop: 8 },
  retryText: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: roles.text,
    textDecorationLine: "underline",
  },
});
