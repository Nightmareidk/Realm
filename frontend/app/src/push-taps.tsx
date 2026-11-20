import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import { useEffect, useRef } from "react";
import { PUSH_SUPPORTED, pushTarget } from "./push";
import { useSession } from "./session";

/**
 * A tapped notification opens what it's about: the chat, the post, the person, or Activity. Works
 * when the tap started the app too (the last tap is waiting for us), once someone is signed in.
 */
export function PushTaps() {
  if (!PUSH_SUPPORTED) return null;
  return <Taps />;
}

function Taps() {
  const router = useRouter();
  const { session } = useSession();
  const last = Notifications.useLastNotificationResponse();
  const handled = useRef<string | null>(null);
  const signedIn = session.status === "signedIn";

  useEffect(() => {
    if (!signedIn || !last) return;
    const key = last.notification.request.identifier + String(last.notification.date);
    if (handled.current === key) return;
    handled.current = key;
    const to = pushTarget(last.notification.request.content.data);
    if (to.room) {
      router.push({
        pathname: "/chat/[id]",
        params: {
          id: to.room,
          ...(to.kind ? { kind: to.kind } : {}),
          ...(to.name ? { title: to.name } : {}),
        },
      });
    } else if (to.post) {
      router.push({ pathname: "/post/[id]", params: { id: to.post } });
    } else if (to.screen === "follow-requests") {
      router.push("/follow-requests");
    } else if (to.user) {
      router.push({ pathname: "/user/[username]", params: { username: to.user } });
    } else {
      router.push("/activity");
    }
    void Notifications.clearLastNotificationResponseAsync().catch(() => {});
  }, [signedIn, last, router]);

  return null;
}
