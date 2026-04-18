import { useState } from "react";
import JobBox from "./JobBox";

function JobStatusOverview({ jobs, navigate, invoices }) {
  const [showBentonsJobs, setShowBentonsJobs] = useState(true);

  const statuses = [
    "Lead",
    "Contacted",
    "To-Quote",
    "Quoted",
    "Approved",
    "Booked",
    "In Progress",
    "Completed",
  ];

  const activeJobs = (jobs || []).filter((j) => !j.archived);

  const visibleJobs = activeJobs.filter((job) => {
    if (showBentonsJobs) return true;
    return !job.name?.trim().toUpperCase().startsWith("BNT");
  });

  const jobsByStatus = {};
  statuses.forEach((status) => {
    jobsByStatus[status] = visibleJobs.filter((j) => j.status === status);
  });

  return (
    <div className="overview-container">
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          marginBottom: "1rem",
        }}
      >
        <input
          type="checkbox"
          id="showBentonsJobs"
          checked={showBentonsJobs}
          onChange={(e) => setShowBentonsJobs(e.target.checked)}
        />
        <label htmlFor="showBentonsJobs">View Bentons jobs?</label>
      </div>

      {statuses.map((status) => (
        <div className="status-group" key={status}>
          <div className="status-header">
            <h2>{status}</h2>
            <span>{jobsByStatus[status].length}</span>
          </div>

          <div className="status-list">
            {jobsByStatus[status].map((job) => (
              <JobBox
                key={job.id}
                job={job}
                navigate={navigate}
                invoices={invoices}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default JobStatusOverview;
