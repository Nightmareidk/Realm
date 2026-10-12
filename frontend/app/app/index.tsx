import { Redirect } from "expo-router";
import { View } from "react-native";
import { Intro } from "@/intro/intro";
import { useSession } from "@/session";
import { roles } from "@/theme";

/** Signed in goes to Home; everyone else meets the introduction. */
export default function Start() {
  const { session } = useSession();
  if (session.status === "loading") return <View style={{ flex: 1, backgroundColor: roles.bg }} />;
  if (session.status === "signedIn") return <Redirect href="/home" />;
  return <Intro />;
}
