import { useCallback, useEffect, useMemo, useState } from "react";
import "./NotificationCentre.css";

const API_BASE = "";

function applicationServerKey(value) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  return Uint8Array.from([...raw].map((character) => character.charCodeAt(0)));
}

function deviceLabel() {
  const agent = navigator.userAgent || "";
  if (/android/i.test(agent)) return "Android phone";
  if (/iphone/i.test(agent)) return "iPhone";
  if (/ipad/i.test(agent)) return "iPad";
  if (/windows/i.test(agent)) return "Windows computer";
  if (/macintosh/i.test(agent)) return "Mac";
  return "Web browser";
}

function isIosDevice() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent || "");
}

function isStandaloneApp() {
  return (
    window.matchMedia?.("(display-mode: standalone)")?.matches ||
    window.navigator.standalone === true
  );
}

function relativeTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently";
  const minutes = Math.max(0, Math.round((Date.now() - date.getTime()) / 60000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function NotificationCentre({ currentUser, navigate }) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [status, setStatus] = useState({ available: false, publicKey: null, deviceCount: 0 });
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [pendingOpenId, setPendingOpenId] = useState(() =>
    new URLSearchParams(window.location.search).get("jnrNotification"),
  );

  const supported = useMemo(
    () =>
      window.isSecureContext &&
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window &&
      (!isIosDevice() || isStandaloneApp()),
    [],
  );

  useEffect(() => {
    if (!document.querySelector('link[rel="manifest"]')) {
      const manifest = document.createElement("link");
      manifest.rel = "manifest";
      manifest.href = "/manifest.webmanifest";
      document.head.appendChild(manifest);
    }
    if (!document.querySelector('link[rel="apple-touch-icon"]')) {
      const icon = document.createElement("link");
      icon.rel = "apple-touch-icon";
      icon.href = "/jnr-hq-icon.png";
      document.head.appendChild(icon);
    }
  }, []);

  const loadNotifications = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/api/notifications?limit=50`, {
        credentials: "include",
      });
      if (!response.ok) return;
      const data = await response.json();
      setNotifications(Array.isArray(data.notifications) ? data.notifications : []);
      setUnreadCount(Number(data.unreadCount || 0));
    } catch {
      // The bell quietly retries; it should never block the rest of HQ.
    }
  }, []);

  const loadStatus = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/api/notifications/status`, {
        credentials: "include",
      });
      if (!response.ok) return;
      const data = await response.json();
      setStatus(data);
      if (!supported) return;
      const registration = await navigator.serviceWorker.register("/jnr-push-sw.js");
      const subscription = await registration.pushManager.getSubscription();
      setSubscribed(Boolean(subscription));
    } catch {
      setSubscribed(false);
    }
  }, [supported]);

  useEffect(() => {
    loadNotifications();
    loadStatus();
    const interval = window.setInterval(loadNotifications, 45000);
    const onVisibility = () => {
      if (document.visibilityState === "visible") loadNotifications();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [currentUser?.id, loadNotifications, loadStatus]);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return undefined;
    const handleMessage = (event) => {
      if (event.data?.type !== "JNR_NOTIFICATION_OPEN") return;
      setPendingOpenId(event.data.notificationId || null);
      loadNotifications();
      window.focus();
    };
    navigator.serviceWorker.addEventListener("message", handleMessage);
    return () => navigator.serviceWorker.removeEventListener("message", handleMessage);
  }, [loadNotifications]);

  const markRead = useCallback(async (notification) => {
    if (!notification || notification.readAt) return;
    setNotifications((current) =>
      current.map((item) =>
        item.id === notification.id ? { ...item, readAt: new Date().toISOString() } : item,
      ),
    );
    setUnreadCount((current) => Math.max(0, current - 1));
    await fetch(`${API_BASE}/api/notifications/${encodeURIComponent(notification.id)}/read`, {
      method: "PUT",
      credentials: "include",
    }).catch(() => undefined);
  }, []);

  const openNotification = useCallback(async (notification) => {
    if (!notification) return;
    await markRead(notification);
    setOpen(false);
    const target = notification.target || {};
    if (target.screen) navigate?.(target.screen, target.data || {});
  }, [markRead, navigate]);

  useEffect(() => {
    if (!pendingOpenId || !notifications.length) return;
    const notification = notifications.find((item) => item.id === pendingOpenId);
    const url = new URL(window.location.href);
    url.searchParams.delete("jnrNotification");
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
    setPendingOpenId(null);
    if (notification) openNotification(notification);
  }, [notifications, openNotification, pendingOpenId]);

  async function enablePush() {
    setBusy(true);
    setMessage("");
    try {
      if (!supported) {
        if (isIosDevice() && !isStandaloneApp()) {
          throw new Error(
            "On iPhone, add JNR HQ to your Home Screen, open it there, then press Enable again.",
          );
        }
        throw new Error("Phone notifications need HTTPS and a supported browser.");
      }
      if (!status.available || !status.publicKey) {
        throw new Error("Install the server update before enabling phone notifications.");
      }
      const permission = await window.Notification.requestPermission();
      if (permission !== "granted") {
        throw new Error("Notifications were not allowed in this browser.");
      }
      const registration = await navigator.serviceWorker.register("/jnr-push-sw.js");
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: applicationServerKey(status.publicKey),
        });
      }
      const response = await fetch(`${API_BASE}/api/notifications/subscribe`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription: subscription.toJSON(), deviceLabel: deviceLabel() }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not enable notifications.");
      setSubscribed(true);
      setStatus((current) => ({ ...current, deviceCount: data.deviceCount }));
      setMessage("Phone notifications are on for this device.");
    } catch (error) {
      setMessage(error.message || "Could not enable notifications.");
    } finally {
      setBusy(false);
    }
  }

  async function disablePush() {
    setBusy(true);
    setMessage("");
    try {
      const registration = await navigator.serviceWorker.getRegistration("/jnr-push-sw.js");
      const subscription = await registration?.pushManager.getSubscription();
      await fetch(`${API_BASE}/api/notifications/subscribe`, {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: subscription?.endpoint || "" }),
      });
      if (subscription) await subscription.unsubscribe();
      setSubscribed(false);
      setStatus((current) => ({ ...current, deviceCount: Math.max(0, current.deviceCount - 1) }));
      setMessage("Phone notifications are off on this device.");
    } catch {
      setMessage("Could not turn notifications off on this device.");
    } finally {
      setBusy(false);
    }
  }

  async function markAllRead() {
    setNotifications((current) =>
      current.map((notification) => ({
        ...notification,
        readAt: notification.readAt || new Date().toISOString(),
      })),
    );
    setUnreadCount(0);
    await fetch(`${API_BASE}/api/notifications/read-all`, {
      method: "POST",
      credentials: "include",
    }).catch(() => undefined);
  }

  return (
    <div className="notificationCentre">
      {open && <button className="notificationBackdrop" type="button" aria-label="Close notifications" onClick={() => setOpen(false)} />}
      <button
        className={`notificationBell ${open ? "active" : ""}`}
        type="button"
        onClick={() => {
          setOpen((current) => !current);
          setMessage("");
          loadNotifications();
        }}
        aria-label={`${unreadCount} unread notifications`}
        title="Notifications"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></svg>
        {unreadCount > 0 && <span>{unreadCount > 99 ? "99+" : unreadCount}</span>}
      </button>

      {open && (
        <section className="notificationPanel" aria-label="JNR HQ notifications">
          <header>
            <div><span>JNR people</span><strong>Notifications</strong></div>
            {unreadCount > 0 && <button type="button" onClick={markAllRead}>Mark all read</button>}
          </header>

          <div className={`notificationPushState ${subscribed ? "enabled" : ""}`}>
            <span className="notificationPushIcon">{subscribed ? "✓" : "↗"}</span>
            <span><strong>{subscribed ? "Phone notifications on" : "Get updates on this device"}</strong><small>{subscribed ? "Schedule and TODO changes can reach you when HQ is closed." : "Enable once on each phone or computer you use."}</small></span>
            <button type="button" onClick={subscribed ? disablePush : enablePush} disabled={busy}>{busy ? "Working…" : subscribed ? "Turn off" : "Enable"}</button>
          </div>
          {message && <p className="notificationMessage">{message}</p>}

          <div className="notificationList">
            {notifications.map((notification) => (
              <button
                className={notification.readAt ? "" : "unread"}
                type="button"
                onClick={() => openNotification(notification)}
                key={notification.id}
              >
                <i />
                <span><strong>{notification.title}</strong><small>{notification.body}</small><em>{relativeTime(notification.createdAt)}</em></span>
              </button>
            ))}
            {!notifications.length && (
              <div className="notificationEmpty"><span>✓</span><strong>You're all caught up</strong><small>Schedule changes and new actions will appear here.</small></div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

export default NotificationCentre;
