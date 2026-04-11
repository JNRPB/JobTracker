function ArchivedJobs({ jobs, setActiveComponent, setActiveJobId }) {
  const archivedJobs = jobs.filter((j) => j.archived);

  return (
    <div className="overview-container">
      <h2 style={{ textAlign: "center", marginBottom: "1rem" }}>
        Archived Jobs
      </h2>

      {archivedJobs.length === 0 && (
        <p style={{ textAlign: "center", opacity: 0.6 }}>No archived jobs</p>
      )}

      <div className="status-group">
        <div className="status-list">
          {archivedJobs.map((job) => (
            <div
              key={job.id}
              className="job-card"
              onClick={() => {
                setActiveJobId(job.id);
                setActiveComponent("JobCard");
              }}
              style={{
                opacity: 0.7,
                background: "#444",
              }}
            >
              {job.name}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default ArchivedJobs;
