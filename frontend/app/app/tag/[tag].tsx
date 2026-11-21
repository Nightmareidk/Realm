import type { Post } from "@realm/contracts";
import { FlashList, type ViewToken } from "@shopify/flash-list";
import { useLocalSearchParams } from "expo-router";
import { useRef, useState } from "react";
import { usePosts } from "@/data";
import { PostCard } from "@/social/post-card";
import { AppScreen, Empty, Loading, Problem, TopBar } from "@/social/screen";

/** Everything posted under one #tag, newest first. Only public posts ever show here. */
export default function TagPosts() {
  const { tag } = useLocalSearchParams<{ tag: string }>();
  const name = (tag ?? "").toLowerCase();
  const feed = usePosts(name ? `/tags/${encodeURIComponent(name)}/posts` : null);
  // The post on screen with a video in it plays that video by itself, as in Home.
  const [playing, setPlaying] = useState<string | null>(null);
  const onViewable = useRef(({ viewableItems }: { viewableItems: ViewToken<Post>[] }) => {
    setPlaying(
      viewableItems.find((v) => v.item?.media.some((m) => m.kind === "video"))?.item?.id ?? null,
    );
  }).current;

  return (
    <AppScreen>
      <TopBar title={`#${name}`} />
      <FlashList
        data={feed.items}
        keyExtractor={(p) => p.id}
        onViewableItemsChanged={onViewable}
        viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
        extraData={playing}
        renderItem={({ item }) => (
          <PostCard
            post={item}
            onChange={feed.update}
            onRemoved={feed.remove}
            active={item.id === playing}
          />
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
