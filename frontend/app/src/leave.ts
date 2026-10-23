import type { useRouter } from "expo-router";

type Router = ReturnType<typeof useRouter>;

/**
 * Close this screen: back where you came from, or (opened straight from a link or after a
 * refresh, with nothing behind it) to `fallback`, Home unless said otherwise.
 */
export function leave(router: Router, fallback: Parameters<Router["replace"]>[0] = "/home") {
  if (router.canGoBack()) router.back();
  else router.replace(fallback);
}
