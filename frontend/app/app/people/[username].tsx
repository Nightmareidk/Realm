import type { UserSummary } from "@realm/contracts";
import { useLocalSearchParams } from "expo-router";
import { FlatList } from "react-native";
import { useApi } from "@/data";
import { PersonRow } from "@/social/person-row";
import { AppScreen, Empty, Loading, Problem, TopBar } from "@/social/screen";

/** Someone's followers, or who they follow. */
export default function People() {
  const { username, side } = useLocalSearchParams<{
    username: string;
    side: "followers" | "following";
  }>();
  const list = useApi<{ items: UserSummary[] }>(
    `/users/${username}/${side === "following" ? "following" : "followers"}`,
  );
  return (
    <AppScreen>
      <TopBar title={side === "following" ? "Following" : "Followers"} />
      {list.error && !list.data ? (
        <Problem message={list.error} onRetry={list.reload} />
      ) : !list.data ? (
        <Loading />
      ) : (
        <FlatList
          data={list.data.items}
          keyExtractor={(u) => u.id}
          renderItem={({ item }) => <PersonRow user={item} />}
          ListEmptyComponent={
            <Empty title={side === "following" ? "Not following anyone yet" : "No followers yet"} />
          }
        />
      )}
    </AppScreen>
  );
}
