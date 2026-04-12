function JobStatusOverview({ jobs, navigate }) {
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

  // 🚨 FILTER OUT ARCHIVED JOBS FIRST
  const activeJobs = jobs.filter((j) => !j.archived);

  // Organize jobs by status
  const jobsByStatus = {};
  statuses.forEach((status) => {
    jobsByStatus[status] = activeJobs.filter((j) => j.status === status);
  });

  return (
    <div className="overview-container">
      {statuses.map((status) => (
        <div className="status-group" key={status}>
          <div className="status-header">
            <h2>{status}</h2>
            <span>{jobsByStatus[status].length}</span>
          </div>

          <div className="status-list">
            {jobsByStatus[status].map((job) => (
              <div
                key={job.id}
                className="job-card"
                onClick={() => {
                  navigate("JobCard", job.id);
                }}
              >
                {job.name}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default JobStatusOverview;
