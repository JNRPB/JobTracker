function Homepage({ jobs, setActiveComponent, setActiveJobId }) {
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

  // Organize jobs by status
  const jobsByStatus = {};
  statuses.forEach((status) => {
    jobsByStatus[status] = jobs.filter((j) => j.status === status);
  });

  return (
    <div className="homepage-container">
      {/* Date & Time */}

      {statuses.map((status) => (
        <div className="status-column" key={status}>
          <h2 style={{ color: "white" }}>{status}</h2>
          <div className="job-count">{jobsByStatus[status].length} jobs</div>

          {jobsByStatus[status].map((job) => (
            <div
              key={job.id}
              className="job-card"
              data-fulltext={job.name}
              onClick={() => {
                setActiveJobId(job.id);
                setActiveComponent("JobCard");
              }}
            >
              {job.name}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export default Homepage;
