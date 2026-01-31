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
    <div
      className="homepage-container"
      style={{
        display: "flex",
        gap: "1rem",
        maxWidth: "100%",
        alignItems: "stretch", // make all columns same height
        height: "80vh",
        padding: "1rem",
      }}
    >
      {statuses.map((status) => (
        <div
          className="status-column"
          key={status}
          style={{
            flex: "0 0 200px",
            backgroundColor: "#1e1e2f",
            padding: "0.5rem",
            borderRadius: "8px",
          }}
        >
          <h2 style={{ color: "white" }}>{status}</h2>
          <div className="job-count">{jobsByStatus[status].length} jobs</div>

          {jobsByStatus[status].map((job) => (
            <div
              key={job.id}
              className="job-card"
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
