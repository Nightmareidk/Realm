import { FlashList } from "@shopify/flash-list";
import { useLocalSearchParams } from "expo-router";
import { usePosts } from "@/data";
import { PostCard } from "@/social/post-card";
import { AppScreen, Empty, Loading, Problem, TopBar } from "@/social/screen";

/** Everything posted under one #tag, newest first. Only public posts ever show here. */
export default function TagPosts() {
  const { tag } = useLocalSearchParams<{ tag: string }>();
  const name = (tag ?? "").toLowerCase();
  const feed = usePosts(name ? `/tags/${encodeURIComponent(name)}/posts` : null);

  return (
    <AppScreen>
      <TopBar title={`#${name}`} />
      <FlashList
        data={feed.items}
        keyExtractor={(p) => p.id}
        renderItem={({ item }) => (
          <PostCard post={item} onChange={feed.update} onRemoved={feed.remove} />
        )}
        ListEmptyComponent={
          feed.loading ? (
            <Loading shape="feed" />
          ) : feed.error ? (
            <Problem message={feed.error} onRetry={feed.refresh} />
          ) : (
            <Empty
              title={`Nothing under #${name} yet`}
              line="Public posts with this tag in their caption show up here."
            />
          )
        }
        onEndReached={feed.more}
        onEndReachedThreshold={0.6}
        refreshing={feed.refreshing && !feed.loading}
        onRefresh={feed.refresh}
      />
    </AppScreen>
  );
}
