import { useRouter } from "expo-router";
import { StyleSheet, View } from "react-native";
import { FormScreen } from "@/screen";
import { Lead, Pill, Title } from "@/ui";

/** A link that doesn't lead to a screen (an old link, a typo): say so, and offer the way back. */
export default function NotFound() {
  const router = useRouter();
  return (
    <FormScreen>
      <View style={s.head}>
        <Title>There's nothing here.</Title>
        <Lead style={s.lead}>
          This link doesn't lead to a screen in Realm. It may be old, or have a typo.
        </Lead>
      </View>
      <View style={s.foot}>
        <Pill label="Go to the start" onPress={() => router.replace("/")} />
      </View>
    </FormScreen>
  );
}

const s = StyleSheet.create({
  head: { marginTop: 28 },
  lead: { marginTop: 12 },
  foot: { marginTop: "auto", paddingTop: 32 },
});
