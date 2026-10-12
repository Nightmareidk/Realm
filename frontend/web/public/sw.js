/*
 * Realm's service worker: push notifications only. Firebase Cloud Messaging delivers a data
 * message ({ title, body, link, tag }); this shows it, and a tap opens the room it's about.
 * Notifications with the same tag (one per room) replace each other instead of piling up.
 */
self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = {};
  }
  const d = payload.data || payload;
  if (!d.title) return;
  event.waitUntil(
    self.registration.showNotification(d.title, {
      body: d.body || "",
      tag: d.tag || undefined,
      renotify: Boolean(d.tag),
      icon: "/icon.png",
      badge: "/icon.png",
      data: { link: typeof d.link === "string" && d.link.startsWith("/") ? d.link : "/home" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const link = (event.notification.data && event.notification.data.link) || "/home";
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const w of windows) {
        if (new URL(w.url).origin === self.location.origin) {
          await w.focus();
          if ("navigate" in w) await w.navigate(link);
          return;
        }
      }
      await self.clients.openWindow(link);
    })(),
  );
});
