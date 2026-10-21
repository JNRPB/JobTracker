self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data ? event.data.text() : "" };
  }

  event.waitUntil(
    self.registration.showNotification(payload.title || "JNR HQ", {
      body: payload.body || "Open JNR HQ to view the update.",
      tag: payload.notificationId
        ? `jnr-notification-${payload.notificationId}`
        : "jnr-notification",
      renotify: true,
      data: {
        notificationId: payload.notificationId || null,
        url: payload.url || "/",
      },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || "/", self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((client) => client.url.startsWith(self.location.origin));
      if (existing) {
        existing.postMessage({
          type: "JNR_NOTIFICATION_OPEN",
          notificationId: event.notification.data?.notificationId || null,
        });
        return existing.focus();
      }
      return self.clients.openWindow(url);
    }),
  );
});
