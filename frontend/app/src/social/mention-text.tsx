import { useRouter } from "expo-router";
import { Fragment, type ReactNode } from "react";
import { Text, type TextStyle } from "react-native";
import { useTheme } from "../theme";

/** An @name or a #tag, with the character before it (which decides whether it counts). */
const LINKS = /(^|[^\p{L}\p{N}_&#@])(@[a-z0-9_.]{1,30}|#[\p{L}\p{N}_]{2,50})(?![\p{L}\p{N}_])/giu;

/**
 * Text with @names that open those profiles and #tags that open that tag's posts, in the
 * theme's link colour. The same rule as the server's: "#1" and "mail@site.com#top" aren't links.
 */
export function MentionText({ text, style }: { text: string; style?: TextStyle }) {
  const { t } = useTheme();
  const router = useRouter();
  const link = [style, { fontFamily: t.fonts.bold, color: t.colors.link ?? t.colors.text }];
  const out: ReactNode[] = [];
  let at = 0;
  for (const m of text.matchAll(LINKS)) {
    const [, before = "", found = ""] = m;
    const start = (m.index ?? 0) + before.length;
    const isTag = found.startsWith("#");
    // "@noor." at the end of a sentence is @noor; "#2024" is a number, not a topic.
    const word = isTag ? found.slice(1) : found.slice(1).replace(/\.+$/, "");
    if (!word || (isTag && /^\d+$/.test(word))) continue;
    out.push(<Fragment key={`t${at}`}>{text.slice(at, start)}</Fragment>);
    out.push(
      <Text
        key={`l${start}`}
        style={link}
        accessibilityRole="link"
        onPress={() =>
          isTag
            ? router.push({ pathname: "/tag/[tag]", params: { tag: word.toLowerCase() } })
            : router.push({
                pathname: "/user/[username]",
                params: { username: word.toLowerCase() },
              })
        }
      >
        {isTag ? "#" : "@"}
        {word}
      </Text>,
    );
    at = start + 1 + word.length;
  }
  out.push(<Fragment key={`t${at}`}>{text.slice(at)}</Fragment>);
  return <>{out}</>;
}
