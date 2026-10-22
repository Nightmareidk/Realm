import { resolveTheme, type ThemeLook, type ThemeSummary } from "@realm/contracts";
import { LOOKS, lookTheme } from "@realm/design-tokens";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useMemo } from "react";
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useApi } from "@/data";
import { Icon } from "@/icon";
import type { IconName } from "@/icon-paths";
import { webOrigin } from "@/server";
import { AppScreen, TopBar } from "@/social/screen";
import { type NativeTheme, THEME_ORDER, type ThemeId, themes, useStyles, useTheme } from "@/theme";
import { ThemePreview } from "@/themes/preview";
import { themeChoice, useApplyTheme } from "@/themes/use";

/**
 * Settings › Themes: Realm's three looks (Now Playing is the default), your colour, the themes in
 * your library, and the doors to more: the store, making your own, adding a theme file, and the
 * guide. Whatever the theme, buttons, messages and safety labels work the same.
 */
export default function Themes() {
  const { t, choice, previewing, preview } = useTheme();
  const s = useStyles(make);
  const router = useRouter();
  const apply = useApplyTheme();
  const library = useApi<{ items: ThemeSummary[] }>("/themes/library");
  const accent: ThemeId = choice.kind === "look" ? choice.accent : "mint";
  const looks = useMemo(
    () => LOOKS.map((l) => ({ ...l, theme: resolveTheme(lookTheme(l.id, accent)) })),
    [accent],
  );

  const pickLook = (look: ThemeLook) => apply({ kind: "look", look, accent });
  const pickLibrary = async (item: ThemeSummary) => {
    try {
      await apply(await themeChoice(item.id));
    } catch {
      library.reload();
    }
  };

  const guide = () => {
    const web = webOrigin() ?? "https://tomyrealm.com";
    Linking.openURL(`${web}/themes/guide`).catch(() => {});
  };

  return (
    <AppScreen>
      <TopBar title="Themes" />
      <ScrollView contentContainerStyle={s.body}>
        <Text style={s.lead}>
          Change how Realm looks. Buttons, messages and safety labels always work the same.
        </Text>

        {previewing ? (
          <View style={s.trying}>
            <Text style={s.tryingText}>You're trying a theme on.</Text>
            <Pressable onPress={() => preview(null)} accessibilityRole="button" style={s.tryingBtn}>
              <Text style={s.tryingBtnText}>Stop trying</Text>
            </Pressable>
          </View>
        ) : null}

        <Text style={s.heading} accessibilityRole="header">
          Realm's looks
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.looks}
          accessibilityRole="radiogroup"
        >
          {looks.map((l) => {
            const on = choice.kind === "look" && choice.look === l.id;
            return (
              <Pressable
                key={l.id}
                onPress={() => pickLook(l.id)}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                accessibilityLabel={`${l.name}. ${l.blurb}`}
                style={[s.look, on && s.lookOn]}
              >
                <ThemePreview theme={l.theme} width={112} />
                <View style={s.lookName}>
                  <Text style={s.lookTitle}>{l.name}</Text>
                  {on ? <Icon name="CheckCircleFill" size={18} color={t.colors.text} /> : null}
                </View>
                <Text style={s.lookLine} numberOfLines={3}>
                  {l.id === "now-playing" ? `Realm's own. ${l.blurb}` : l.blurb}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {choice.kind === "look" ? (
          <>
            <Text style={s.heading} accessibilityRole="header">
              Your colour
            </Text>
            <View style={s.swatches} accessibilityRole="radiogroup">
              {THEME_ORDER.map((id) => {
                const [l1, l2, l3] = themes[id].lights;
                const on = id === accent;
                return (
                  <Pressable
                    key={id}
                    onPress={() => apply({ kind: "look", look: choice.look, accent: id })}
                    accessibilityRole="radio"
                    accessibilityLabel={themes[id].name}
                    accessibilityState={{ checked: on }}
                    style={[s.swatchWrap, on && s.swatchOn]}
                  >
                    <LinearGradient
                      colors={[l1, l2, l3]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={s.swatch}
                    >
                      <Text style={s.swatchName}>{themes[id].name}</Text>
                    </LinearGradient>
                  </Pressable>
                );
              })}
            </View>
          </>
        ) : null}

        <Text style={s.heading} accessibilityRole="header">
          Your themes
        </Text>
        {library.data?.items.length ? (
          library.data.items.map((item) => {
            const on = choice.kind === "theme" && choice.themeId === item.id;
            return (
              <Pressable
                key={item.id}
                onPress={() => router.push(`/themes/${item.id}`)}
                accessibilityRole="button"
                accessibilityLabel={`${item.name}, ${item.mine ? "made by you" : `by ${item.creator.username}`}`}
                style={s.row}
              >
                <ThemePreview theme={resolveTheme(item.file)} width={44} />
                <View style={s.rowText}>
                  <Text style={s.rowTitle} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={s.rowLine} numberOfLines={1}>
                    {item.mine ? "Made by you" : `by @${item.creator.username}`}
                  </Text>
                </View>
                {on ? (
                  <Text style={s.using}>Using</Text>
                ) : (
                  <Pressable
                    onPress={() => pickLibrary(item)}
                    accessibilityRole="button"
                    accessibilityLabel={`Use ${item.name}`}
                    style={s.useBtn}
                  >
                    <Text style={s.useText}>Use</Text>
                  </Pressable>
                )}
              </Pressable>
            );
          })
        ) : (
          <Text style={s.none}>
            {library.loading
              ? "Loading your themes…"
              : (library.error ?? "Themes you make, get or buy show up here.")}
          </Text>
        )}

        <View style={s.actions}>
          <Action
            icon="Storefront"
            title="More themes"
            line="Themes other people made, free and paid"
            onPress={() => router.push("/themes/store")}
          />
          <Action
            icon="PaintBrushBroad"
            title="Make your own"
            line="Colours, wallpaper, stickers, effects and more"
            onPress={() => router.push("/themes/studio")}
          />
          <Action
            icon="UploadSimple"
            title="Add your own theme"
            line="Paste a theme file someone shared with you"
            onPress={() => router.push("/themes/add")}
          />
          <Action
            icon="Question"
            title="How to make a theme"
            line="The guide, on the website"
            onPress={guide}
          />
          {choice.kind === "theme" ? (
            <Action
              icon="ArrowCounterClockwise"
              title="Back to Realm's default"
              line="Now Playing in your colour"
              onPress={() => pickLook("now-playing")}
            />
          ) : null}
        </View>
      </ScrollView>
    </AppScreen>
  );
}

function Action({
  icon,
  title,
  line,
  onPress,
}: {
  icon: IconName;
  title: string;
  line: string;
  onPress: () => void;
}) {
  const { t } = useTheme();
  const s = useStyles(make);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${line}`}
      style={({ pressed }) => [s.action, pressed && s.pressed]}
    >
      <View style={s.actionIcon}>
        <Icon name={icon} size={22} color={t.colors.text} />
      </View>
      <View style={s.rowText}>
        <Text style={s.rowTitle}>{title}</Text>
        <Text style={s.rowLine}>{line}</Text>
      </View>
      <Icon name="CaretRight" size={18} color={t.colors.textSoft} />
    </Pressable>
  );
}

const make = (t: NativeTheme) =>
  StyleSheet.create({
    body: { paddingBottom: 48 },
    lead: {
      fontFamily: t.fonts.body,
      fontSize: 16 * t.textScale,
      lineHeight: 23 * t.textScale,
      color: t.colors.textSoft,
      paddingHorizontal: 20,
      paddingTop: 16,
    },
    trying: {
      margin: 16,
      marginBottom: 0,
      padding: 14,
      borderRadius: t.radius.box,
      backgroundColor: t.colors.surfaceRaised,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    tryingText: {
      flex: 1,
      fontFamily: t.fonts.bold,
      fontSize: 15 * t.textScale,
      color: t.colors.text,
    },
    tryingBtn: { minHeight: 40, justifyContent: "center", paddingHorizontal: 14 },
    tryingBtnText: {
      fontFamily: t.fonts.bold,
      fontSize: 15 * t.textScale,
      color: t.colors.text,
      textDecorationLine: "underline",
    },
    heading: {
      fontFamily: t.fonts.displayBold,
      fontSize: 19 * t.textScale,
      color: t.colors.text,
      paddingHorizontal: 20,
      marginTop: 26,
      marginBottom: 12,
    },
    looks: { gap: 12, paddingHorizontal: 16 },
    look: {
      width: 136,
      padding: 12,
      borderRadius: t.radius.box,
      backgroundColor: t.colors.surface,
      borderWidth: 2,
      borderColor: "transparent",
      gap: 8,
    },
    lookOn: { borderColor: t.colors.text },
    lookName: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    lookTitle: { fontFamily: t.fonts.bold, fontSize: 15 * t.textScale, color: t.colors.text },
    lookLine: {
      fontFamily: t.fonts.body,
      fontSize: 13 * t.textScale,
      lineHeight: 18 * t.textScale,
      color: t.colors.textSoft,
    },
    swatches: { flexDirection: "row", gap: 10, paddingHorizontal: 16 },
    swatchWrap: {
      flex: 1,
      borderRadius: 18,
      padding: 3,
      borderWidth: 2,
      borderColor: "transparent",
    },
    swatchOn: { borderColor: t.colors.text },
    swatch: { height: 64, borderRadius: 14, justifyContent: "flex-end", padding: 8 },
    swatchName: { fontFamily: t.fonts.bold, fontSize: 13 * t.textScale, color: "#ffffff" },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
      paddingHorizontal: 20,
      paddingVertical: 10,
    },
    rowText: { flex: 1, minWidth: 0 },
    rowTitle: { fontFamily: t.fonts.bold, fontSize: 16 * t.textScale, color: t.colors.text },
    rowLine: {
      fontFamily: t.fonts.body,
      fontSize: 14 * t.textScale,
      color: t.colors.textSoft,
      marginTop: 2,
    },
    using: { fontFamily: t.fonts.bold, fontSize: 14 * t.textScale, color: t.colors.textSoft },
    useBtn: {
      minHeight: 40,
      paddingHorizontal: 18,
      borderRadius: 999,
      backgroundColor: t.colors.surfaceRaised,
      justifyContent: "center",
    },
    useText: { fontFamily: t.fonts.bold, fontSize: 15 * t.textScale, color: t.colors.text },
    none: {
      fontFamily: t.fonts.body,
      fontSize: 15 * t.textScale,
      color: t.colors.textSoft,
      paddingHorizontal: 20,
    },
    actions: {
      marginTop: 22,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: t.colors.border,
    },
    action: {
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
      paddingHorizontal: 20,
      paddingVertical: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.colors.border,
    },
    actionIcon: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: t.colors.surfaceRaised,
      alignItems: "center",
      justifyContent: "center",
    },
    pressed: { opacity: 0.7 },
  });
