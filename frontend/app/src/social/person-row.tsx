import type { UserSummary } from "@realm/contracts";
import { useRouter } from "expo-router";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { fonts, roles } from "../theme";
import { Avatar } from "./avatar";

/** A person in a list: picture, name and @handle; tap for their profile. */
export function PersonRow({
  user,
  line,
  right,
}: {
  user: UserSummary;
  line?: string;
  right?: ReactNode;
}) {
  const router = useRouter();
  return (
    <View style={s.row}>
      <Pressable
        onPress={() =>
          router.push({ pathname: "/user/[username]", params: { username: user.username } })
        }
        accessibilityRole="link"
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

const s = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 10,
  },
  who: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12, minHeight: 52 },
  text: { flex: 1 },
  name: { fontFamily: fonts.bold, fontSize: 15.5, color: roles.text },
  handle: { fontFamily: fonts.body, fontSize: 14, color: roles.textSoft, marginTop: 1 },
});
