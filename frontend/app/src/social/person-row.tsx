import type { UserSummary } from "@realm/contracts";
import { useRouter } from "expo-router";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { type NativeTheme, useStyles } from "../theme";
import { Avatar } from "./avatar";
import { Verified } from "./verified";

/** A person in a list: picture, name and @handle; tap for their profile (unless it's hidden). */
export function PersonRow({
  user,
  line,
  right,
  linked = true,
}: {
  user: UserSummary;
  line?: string;
  right?: ReactNode;
  /** Off when their profile can't open (someone you've blocked). */
  linked?: boolean;
}) {
  const s = useStyles(make);
  const router = useRouter();
  return (
    <View style={s.row}>
      <Pressable
        onPress={() =>
          router.push({ pathname: "/user/[username]", params: { username: user.username } })
        }
        disabled={!linked}
        accessibilityRole={linked ? "link" : "text"}
        accessibilityLabel={`${user.displayName}, @${user.username}`}
        style={s.who}
      >
        <Avatar user={user} size={48} />
        <View style={s.text}>
          <View style={s.nameRow}>
            <Text style={s.name} numberOfLines={1}>
              {user.displayName}
            </Text>
            <Verified kind={user.verified} size={14} />
          </View>
          <Text style={s.handle} numberOfLines={1}>
            {line ?? `@${user.username}`}
          </Text>
        </View>
      </Pressable>
      {right}
    </View>
  );
}

const make = (t: NativeTheme) =>
  StyleSheet.create({
    nameRow: { flexDirection: "row", alignItems: "center", gap: 4 },
    row: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingVertical: 8,
      gap: 10,
    },
    who: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12, minHeight: 52 },
    text: { flex: 1 },
    name: { fontFamily: t.fonts.bold, fontSize: 15.5 * t.textScale, color: t.colors.text },
    handle: {
      fontFamily: t.fonts.body,
      fontSize: 14 * t.textScale,
      color: t.colors.textSoft,
      marginTop: 1,
    },
  });
