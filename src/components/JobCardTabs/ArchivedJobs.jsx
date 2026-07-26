function ArchivedJobs({ jobs, navigate, onUnarchive }) {
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
              style={{
                opacity: 0.7,
                background: "#444",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "0.75rem",
              }}
            >
              <span
                onClick={() => navigate("JobCard", { jobId: job.id })}
                style={{ cursor: "pointer", flex: 1 }}
              >
                {job.name}
              </span>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onUnarchive(job.id);
                }}
                style={{
                  background: "#52c41a",
                  color: "#fff",
                  border: "none",
                  borderRadius: "4px",
                  padding: "0.4rem 0.75rem",
                  cursor: "pointer",
                }}
              >
                Unarchive
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default ArchivedJobs;

