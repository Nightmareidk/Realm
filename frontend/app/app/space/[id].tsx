import type { SpaceDetail } from "@realm/contracts";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { alert } from "@/alert";
import { useApi } from "@/data";
import { Icon } from "@/icon";
import { ApiError, api } from "@/server";
import { AppScreen, Empty, Loading, TopBar } from "@/social/screen";
import { SpaceBadge } from "@/social/space-badge";
import { compact } from "@/social/time";
import { type NativeTheme, useStyles, useTheme } from "@/theme";
import { Pill } from "@/ui";

/**
 * A Space: its rooms. Text rooms open the chat; voice rooms join from the app once voice lands
 * here (it works on the website today). Not a member yet: join a public Space from here.
 */
export default function SpaceScreen() {
  const { t } = useTheme();
  const s = useStyles(make);
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const space = useApi<SpaceDetail>(`/communities/${id}`);
  const [joining, setJoining] = useState(false);

  async function join() {
    setJoining(true);
    try {
      space.setData(await api<SpaceDetail>(`/communities/${id}/join`, { method: "POST" }));
    } catch (err) {
      alert("Couldn't join", err instanceof ApiError ? err.message : "Try again.");
    } finally {
      setJoining(false);
    }
  }

  if (!space.data) {
    return (
      <AppScreen>
        <TopBar title="Space" />
        {space.loading ? (
          <Loading />
        ) : (
          <Empty
            title="You're not in this Space yet"
            line="Public Spaces open to everyone can be joined right here. Private ones need an invite from a member."
          >
            <Pill label="Join" pending={joining} pendingLabel="Joining" onPress={join} />
          </Empty>
        )}
      </AppScreen>
    );
  }

  const sp = space.data;
  const text = sp.channels.filter((c) => c.type === "text" || c.type === "announcement");
  const voice = sp.channels.filter((c) => c.type === "voice");
  return (
    <AppScreen>
      <TopBar
        title={sp.name}
        right={
          <Pressable
            onPress={() =>
              router.push({ pathname: "/space/settings/[id]", params: { id: sp.slug } })
            }
            accessibilityRole="button"
            accessibilityLabel="Space settings: Glow, AutoMod, audit log, invites"
            style={s.gear}
          >
            <Icon name="Gear" size={22} color={t.colors.text} />
          </Pressable>
        }
      />
      <ScrollView contentContainerStyle={s.body}>
        <View style={s.head}>
          <SpaceBadge name={sp.name} accent={sp.accent} size={64} />
          <View style={s.fill}>
            <Text style={s.name} accessibilityRole="header">
              {sp.name}
            </Text>
            <Text style={s.line}>
              {compact(sp.memberCount)} {sp.memberCount === 1 ? "member" : "members"} ·{" "}
              {sp.visibility === "public" ? "Public" : "Private"}
            </Text>
          </View>
        </View>
        {sp.description ? <Text style={s.desc}>{sp.description}</Text> : null}

        <Text style={s.heading}>Rooms</Text>
        {text.map((c) => (
          <Pressable
            key={c.id}
            onPress={() =>
              router.push({
                pathname: "/chat/[id]",
                params: { id: c.id, title: `#${c.name}`, kind: "room" },
              })
            }
            accessibilityRole="link"
            style={s.room}
          >
            <View style={s.roomIcon}>
              <Icon name="Hash" size={20} color={t.colors.textSoft} />
            </View>
            <Text style={s.roomName}>{c.name}</Text>
            <Icon name="CaretRight" size={18} color={t.colors.textSoft} />
          </Pressable>
        ))}

        {voice.length ? <Text style={s.heading}>Voice</Text> : null}
        {voice.map((c) => (
          <View key={c.id} style={s.room}>
            <View style={s.roomIcon}>
              <Icon name="SpeakerHigh" size={20} color={t.colors.textSoft} />
            </View>
            <View style={s.fill}>
              <Text style={s.roomName}>{c.name}</Text>
              <Text style={s.line}>
                Join from the website for now. Voice comes to the app next.
              </Text>
            </View>
          </View>
        ))}
      </ScrollView>
    </AppScreen>
  );
}

const make = (t: NativeTheme) =>
  StyleSheet.create({
    fill: { flex: 1 },
    gear: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
    body: { padding: 16, paddingBottom: 40 },
    head: { flexDirection: "row", alignItems: "center", gap: 14 },
    name: { fontFamily: t.fonts.displayBold, fontSize: 24 * t.textScale, color: t.colors.text },
    line: {
      fontFamily: t.fonts.body,
      fontSize: 14 * t.textScale,
      color: t.colors.textSoft,
      marginTop: 2,
    },
    desc: {
      fontFamily: t.fonts.body,
      fontSize: 15.5 * t.textScale,
      lineHeight: 23 * t.textScale,
      color: t.colors.text,
      marginTop: 14,
    },
    heading: {
      fontFamily: t.fonts.bold,
      fontSize: 16 * t.textScale,
      color: t.colors.text,
      marginTop: 24,
      marginBottom: 4,
    },
    room: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      minHeight: 56,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: t.colors.border,
    },
    roomIcon: {
      width: 38,
      height: 38,
      borderRadius: 11,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: t.colors.surfaceRaised,
    },
    roomName: {
      flex: 1,
      fontFamily: t.fonts.bold,
      fontSize: 16 * t.textScale,
      color: t.colors.text,
    },
  });
