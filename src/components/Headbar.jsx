import { useEffect, useState } from "react";
import logo from "../assets/logo.png";

const navItems = [
  { label: "Home", component: "WelcomeScreen" },
  { label: "Jobs", component: "JobStatusOverview" },
  { label: "Spend Timeline", component: "SpendCalendar" },
  { label: "Journeys", component: "JobHeatMap" },
  { label: "Create Job", component: "CreateJob" },
  { label: "Archived", component: "ArchivedJobs" },
  { label: "Files", component: "Files" },
  { label: "Business Facts", component: "BusinessFacts" },
  { label: "Forecast Page", component: "ForecastPage" },
];

function Headbar({
  navigate,
  activeComponent,
  goBack,
  goForward,
  canGoBack,
  canGoForward,
}) {
  const [currentTime, setCurrentTime] = useState(new Date());

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
        <div
          className="headbar-brand"
          onClick={() => navigate("WelcomeScreen")}
        >
          <img src={logo} alt="JNR logo" className="headbar-logo" />

          <div className="headbar-brand-info">
            <h1>JNR Dashboard</h1>
            <p>Plastering & Building</p>

            <div className="headbar-history-controls">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  goBack();
                }}
                disabled={!canGoBack}
              >
                ←
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  goForward();
                }}
                disabled={!canGoForward}
              >
                →
              </button>
            </div>
          </div>
        </div>

        <nav className="headbar-nav">
          {navItems.map((item) => {
            const isActive = activeComponent === item.component;

            return (
              <button
                key={item.component}
                className={`headbar-nav-button ${isActive ? "active" : ""}`}
                onClick={() => navigate(item.component)}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="headbar-meta">
          <strong>{timeLabel}</strong>
          <span>{dateLabel}</span>
        </div>
      </div>
    </header>
  );
}

export default Headbar;

