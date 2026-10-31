import { useRouter } from "expo-router";
import { Fragment } from "react";
import { Text, type TextStyle } from "react-native";
import { useTheme } from "../theme";

/** Text with @names that open those profiles, in the theme's link colour. */
export function MentionText({ text, style }: { text: string; style?: TextStyle }) {
  const { t } = useTheme();
  const router = useRouter();
  const parts = text.split(/(@[a-z0-9_.]{1,30})/gi);
  return (
    <>
      {parts.map((p, i) => {
        const name = p.startsWith("@") ? p.slice(1).replace(/\.+$/, "") : null;
        if (!name) {
          // biome-ignore lint/suspicious/noArrayIndexKey: the pieces of one fixed string.
          return <Fragment key={i}>{p}</Fragment>;
        }
        return (
          // biome-ignore lint/suspicious/noArrayIndexKey: the pieces of one fixed string.
          <Fragment key={i}>
            <Text
              style={[style, { fontFamily: t.fonts.bold, color: t.colors.link ?? t.colors.text }]}
              accessibilityRole="link"
              onPress={() =>
                router.push({
                  pathname: "/user/[username]",
                  params: { username: name.toLowerCase() },
                })
              }
            >
              @{name}
            </Text>
            {p.slice(1 + name.length)}
          </Fragment>
        );
      })}
    </>
  );
}
