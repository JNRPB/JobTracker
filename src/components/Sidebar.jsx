import { useState, useEffect } from "react";
import SidebarButton from "./SideBarButton";

function Sidebar({ setActiveComponent, jobs, setActiveJobId }) {
  const [showJobs, setShowJobs] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Update every second
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(interval); // cleanup
  }, []);

  return (
    <div className="sidebar">
      <div
        className="stats-widget"
        style={{ marginBottom: "1rem", fontWeight: "700", fontSize: "1.2rem" }}
      >
        {currentTime.toLocaleTimeString()} <br></br>{" "}
        {currentTime.toLocaleDateString()}
        <br /> <br />
        Welcome to JNR Plastering & Building Dashboard
      </div>
      {/* Homepage */}
      <button onClick={() => setActiveComponent("Homepage")}>
        🏠 Homepage
      </button>

      <button onClick={() => setActiveComponent("MonthlyCashflow")}>
        Monthly Cashflow
      </button>

      {/* Create Job */}
      <SidebarButton
        label="➕ Create Job"
        component="CreateJob"
        setActiveComponent={setActiveComponent}
      />

      {/* All Jobs Toggle */}
      <button className="sidebar-toggle" onClick={() => setShowJobs(!showJobs)}>
        {showJobs ? "▼ All Jobs" : "▶ All Jobs"}
      </button>

      {/* Job List */}
      {showJobs && (
        <div className="job-list">
          {jobs
            .slice()
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((job) => (
              <button
                key={job.id}
                className="job-button-allJobs"
                onClick={() => {
                  setActiveJobId(job.id);
                  setActiveComponent("JobCard");
                }}
              >
                {job.name}
              </button>
            ))}
        </div>
      )}
    </div>
  );
}

export default Sidebar;
