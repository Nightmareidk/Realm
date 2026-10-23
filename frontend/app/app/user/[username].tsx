import { useLocalSearchParams } from "expo-router";
import { ProfileView } from "@/social/profile-view";
import { AppScreen, TopBar } from "@/social/screen";

/** Someone's profile. */
export default function UserProfile() {
  const { username } = useLocalSearchParams<{ username: string }>();
  return (
    <AppScreen max={935}>
      <TopBar title={`@${username}`} />
      <ProfileView username={username} top={null} />
    </AppScreen>
  );
}
