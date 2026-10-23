import type { FollowRequest } from "@realm/contracts";
import * as Haptics from "expo-haptics";
import { useState } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { alert } from "@/alert";
import { useApi } from "@/data";
import { ApiError, api } from "@/server";
import { PersonRow } from "@/social/person-row";
import { AppScreen, Empty, Loading, Problem, TopBar } from "@/social/screen";
import { ago } from "@/social/time";
import { type NativeTheme, useStyles } from "@/theme";
import { Pill } from "@/ui";

/** Everyone asking to follow your private account: Confirm or Delete, one by one. */
export default function FollowRequests() {
  const s = useStyles(make);
  const list = useApi<FollowRequest[]>("/users/@me/follow-requests");
  // Answered here: the row says so instead of vanishing, so you can see what you did.
  const [done, setDone] = useState<Record<string, "confirmed" | "deleted">>({});

  async function respond(r: FollowRequest, accept: boolean) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setDone((d) => ({ ...d, [r.user.id]: accept ? "confirmed" : "deleted" }));
    try {
      await api(`/users/@me/follow-requests/${r.user.username}`, {
        method: accept ? "POST" : "DELETE",
      });
    } catch (err) {
      setDone(({ [r.user.id]: _, ...rest }) => rest);
      alert("That didn't work", err instanceof ApiError ? err.message : "Try again.");
    }
  }

  return (
    <AppScreen>
      <TopBar title="Follow requests" />
      {list.error && !list.data ? (
        <Problem message={list.error} onRetry={list.reload} />
      ) : !list.data ? (
        <Loading />
      ) : (
        <FlatList
          data={list.data}
          keyExtractor={(r) => r.user.id}
          ListHeaderComponent={
            list.data.length ? (
              <Text style={s.note}>
                Your account is private: only people you confirm see your posts and Stories.
              </Text>
            ) : null
          }
          renderItem={({ item }) => {
            const answer = done[item.user.id];
            return (
              <PersonRow
                user={item.user}
                line={`Asked ${ago(item.createdAt)} ago`.replace("now ago", "just now")}
                right={
                  answer ? (
                    <Text style={s.answer}>
                      {answer === "confirmed" ? "Now follows you" : "Removed"}
                    </Text>
                  ) : (
                    <View style={s.actions}>
                      <Pill size="sm" label="Confirm" onPress={() => respond(item, true)} />
                      <Pill
                        size="sm"
                        kind="ghost"
                        label="Delete"
                        onPress={() => respond(item, false)}
                      />
                    </View>
                  )
                }
              />
            );
          }}
          ListEmptyComponent={
            <Empty title="No follow requests" line="When someone asks to follow you, it's here." />
          }
          onRefresh={list.reload}
          refreshing={false}
        />
      )}
    </AppScreen>
  );
}

const make = (t: NativeTheme) =>
  StyleSheet.create({
    note: {
      fontFamily: t.fonts.body,
      fontSize: 13.5 * t.textScale,
      lineHeight: 19 * t.textScale,
      color: t.colors.textSoft,
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    actions: { flexDirection: "row", gap: 6 },
    answer: { fontFamily: t.fonts.bold, fontSize: 13.5 * t.textScale, color: t.colors.textSoft },
  });
