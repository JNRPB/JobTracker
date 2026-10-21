import { useEffect, useState } from "react";
import logo from "../assets/logo.png";
import "./Headbar.css";
import NotificationCentre from "./NotificationCentre";
import { canAccessScreen, defaultScreenForUser, isSiteUser } from "./access";

const navItems = [
  { label: "Home", component: "WelcomeScreen", icon: "home" },
  { label: "Jobs", component: "JobStatusOverview", icon: "jobs" },
  { label: "Schedule", component: "SchedulePage", icon: "schedule" },
  { label: "TODO", component: "TodoPage", icon: "todo" },
  { label: "Spend", component: "SpendCalendar", icon: "spend" },
  { label: "Journeys", component: "JobHeatMap", icon: "journeys" },
  { label: "Files", component: "Files", icon: "files" },
  { label: "VAT", component: "BusinessFacts", icon: "vat" },
  { label: "Activity", component: "ForecastPage", icon: "activity" },
  { label: "Settings", component: "Settings", icon: "settings" },
];

function NavIcon({ name }) {
  const paths = {
    home: <><path d="M3 11.5 12 4l9 7.5" /><path d="M5.5 10.5V20h13v-9.5M9 20v-6h6v6" /></>,
    jobs: <><rect x="3" y="6" width="18" height="14" rx="2" /><path d="M8 6V4h8v2M3 11h18M10 11v2h4v-2" /></>,
    schedule: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M7 3v4M17 3v4M3 10h18M7 14h3M14 14h3M7 18h3" /></>,
    todo: <><rect x="4" y="3" width="16" height="18" rx="2" /><path d="m8 9 2 2 4-4M8 16h8" /></>,
    spend: <><path d="M4 19V9M10 19V5M16 19v-7M22 19H2" /><path d="m3 7 6-4 6 5 6-5" /></>,
    journeys: <><circle cx="6" cy="18" r="2" /><circle cx="18" cy="6" r="2" /><path d="M7.5 16.5 16.5 7.5M9 6H5a2 2 0 0 0-2 2v4" /></>,
    archive: <><path d="M4 7h16v13H4zM3 3h18v4H3z" /><path d="M9 11h6" /></>,
    files: <><path d="M5 3h9l5 5v13H5z" /><path d="M14 3v6h6M8 13h8M8 17h8" /></>,
    vat: <><circle cx="7" cy="7" r="2" /><circle cx="17" cy="17" r="2" /><path d="m18 4-12 16" /></>,
    activity: <><path d="M3 12h4l2.2-6 4.2 12 2.2-6H21" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3V2.8h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z" /></>,
  };

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {paths[name] || paths.home}
    </svg>
  );
}

function Headbar({
  navigate,
  activeComponent,
  goBack,
  goForward,
  canGoBack,
  canGoForward,
  currentUser,
  onLogout,
  todoCount = 0,
}) {
  const [currentTime, setCurrentTime] = useState(new Date());
  const siteWorkspace = isSiteUser(currentUser);
  const visibleNavItems = siteWorkspace
    ? [{ label: "My Work", component: "TeamHome", icon: "home" }]
    : navItems;

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const timeLabel = currentTime.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const dateLabel = currentTime.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });

  return (
    <header className="app-headbar">
      <div className="headbar-inner">
        <div className="headbar-brand-cluster">
          <button
            className="headbar-brand"
            type="button"
            onClick={() => navigate(defaultScreenForUser(currentUser))}
            aria-label="Open your JNR HQ start page"
          >
            <span className="headbar-logo-frame">
              <img src={logo} alt="" className="headbar-logo" />
            </span>

            <span className="headbar-brand-info">
              <span className="headbar-brand-kicker">JNR command centre</span>
              <strong>JNR HQ</strong>
              <small>Plastering &amp; Building</small>
            </span>
          </button>

          <div className="headbar-history-controls" aria-label="Page history">
            <button type="button" onClick={goBack} disabled={!canGoBack} aria-label="Go back">←</button>
            <button type="button" onClick={goForward} disabled={!canGoForward} aria-label="Go forward">→</button>
          </div>
        </div>

        <nav className="headbar-nav" aria-label="Main navigation">
          {visibleNavItems.filter((item) => canAccessScreen(currentUser, item.component)).map((item) => {
            const isActive = activeComponent === item.component;

            return (
              <button
                key={item.component}
                className={`headbar-nav-button ${isActive ? "active" : ""}`}
                onClick={() => navigate(item.component)}
                type="button"
                aria-current={isActive ? "page" : undefined}
              >
                <NavIcon name={item.icon} />
                <span>{item.label}</span>
                {(item.component === "TodoPage" || item.component === "TeamHome") && todoCount > 0 && (
                  <span className="headbar-nav-badge">
                    {todoCount > 99 ? "99+" : todoCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="headbar-meta">
          <span className="headbar-live"><i />HQ live</span>
          <NotificationCentre currentUser={currentUser} navigate={navigate} />
          <button
            className={`headbar-user-chip ${activeComponent === "MyProfile" ? "active" : ""}`}
            type="button"
            onClick={() => navigate("MyProfile")}
            title="Open my profile"
            aria-current={activeComponent === "MyProfile" ? "page" : undefined}
          >
            <strong>{currentUser?.displayName || currentUser?.username || "HQ user"}</strong>
            <small>{currentUser?.role === "admin" ? "Administrator" : siteWorkspace ? "Site workspace" : "Team account"}</small>
          </button>
          <span className="headbar-clock">
            <strong>{timeLabel}</strong>
            <small>{dateLabel}</small>
          </span>
          <button
            className="headbar-logout"
            type="button"
            onClick={onLogout}
            title={`Sign out ${currentUser?.username || "JNR user"}`}
            aria-label="Sign out"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h5M14 8l4 4-4 4M8 12h10" /></svg>
          </button>
        </div>
      </div>
    </header>
  );
}

export default Headbar;
