import type { UserSummary } from "@realm/contracts";
import { useRouter } from "expo-router";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { fonts, type NativeTheme, useStyles } from "../theme";
import { Avatar } from "./avatar";

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
          <Text style={s.name} numberOfLines={1}>
            {user.displayName}
          </Text>
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
    row: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingVertical: 8,
      gap: 10,
    },
    who: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12, minHeight: 52 },
    text: { flex: 1 },
    name: { fontFamily: fonts.bold, fontSize: 15.5, color: t.colors.text },
    handle: { fontFamily: fonts.body, fontSize: 14, color: t.colors.textSoft, marginTop: 1 },
  });
