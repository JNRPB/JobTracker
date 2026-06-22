import { useEffect, useState } from "react";
import JobBox from "./JobBox";

function JobStatusOverview({ jobs = [], navigate }) {
  const [showBentonsJobs, setShowBentonsJobs] = useState(false);
  const [loggedFiles, setLoggedFiles] = useState([]);
  const [tripLinks, setTripLinks] = useState([]);

  useEffect(() => {
    async function fetchData() {
      try {
        const [filesRes, tripLinksRes] = await Promise.all([
          fetch("http://192.168.0.22:3001/api/files"),
          fetch("http://192.168.0.22:3001/api/traccar/trip-links"),
        ]);

        const filesData = await filesRes.json();
        const tripLinksData = await tripLinksRes.json();

        setLoggedFiles(Array.isArray(filesData) ? filesData : []);
        setTripLinks(Array.isArray(tripLinksData) ? tripLinksData : []);
      } catch (err) {
        console.error("Failed to fetch overview data:", err);
      }
    }

    fetchData();
  }, []);

  const statuses = [
    "In Progress",
    "Booked",
    "Approved",
    "Quoted",
    "To-Quote",
    "Contacted",
    "Lead",
    "Completed",
  ];

  const activeJobs = jobs.filter((job) => !job.archived);

  const visibleJobs = activeJobs.filter((job) => {
    if (showBentonsJobs) return true;
    return !job.name?.trim().toUpperCase().startsWith("BNT");
  });

  function getFileLinkedCost(jobId) {
    return loggedFiles.reduce((sum, file) => {
      const links = Array.isArray(file.links) ? file.links : [];

      const jobLinks = links.filter(
        (link) =>
          link.targetType === "job" && String(link.targetId) === String(jobId),
      );

      const jobCost = jobLinks.reduce((linkSum, link) => {
        return linkSum + Number(link.cost || 0);
      }, 0);

      return sum + jobCost;
    }, 0);
  }

  function getJobTripStats(jobId) {
    const jobLinks = tripLinks.filter(
      (link) => String(link.jobId) === String(jobId),
    );

    const visitDays = new Set(
      jobLinks
        .filter((link) => link.type === "job_visit")
        .map((link) => link.date),
    );

    const milesAllocated = jobLinks.reduce((sum, link) => {
      return sum + Number(link.distanceMiles || 0);
    }, 0);

    return {
      daysVisited: visitDays.size,
      milesAllocated,
    };
  }

  const jobsByStatus = {};

  statuses.forEach((status) => {
    jobsByStatus[status] = visibleJobs.filter((job) => job.status === status);
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
            {jobsByStatus[status].map((job) => {
              const fileLinkedCost = getFileLinkedCost(job.id);
              const quoteTotal = Number(job.quoteTotal || 0);
              const margin = quoteTotal - fileLinkedCost;

              return (
                <JobBox
                  key={job.id}
                  job={job}
                  navigate={navigate}
                  margin={margin}
                  fileLinkedCost={fileLinkedCost}
                  tripStats={getJobTripStats(job.id)}
                />
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

export default JobStatusOverview;
