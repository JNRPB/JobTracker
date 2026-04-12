import { useState, useEffect } from "react";

function JobOverview({ job, jobs, onUpdate, deleteJob, onArchive, navigate }) {
  const [localJob, setLocalJob] = useState(job);

  useEffect(() => {
    setLocalJob(job);
  }, [job]);

  function update(field, value) {
    const updated = {
      ...localJob,
      [field]: value,
    };

    setLocalJob(updated);
    if (onUpdate) onUpdate(updated);
  }

  return (
    <div className="bubbleBox2">
      {/* ---------------- NAME ---------------- */}
      <h1
        contentEditable
        suppressContentEditableWarning
        onBlur={(e) => update("name", e.target.innerText)}
        style={{ cursor: "text", marginBottom: "0.3rem" }}
      >
        {job.name}
      </h1>

      {/* ---------------- ADDRESS ---------------- */}
      <p
        contentEditable
        suppressContentEditableWarning
        onBlur={(e) => update("address", e.target.innerText)}
        style={{ opacity: 0.8, cursor: "text" }}
      >
        {job.address}
      </p>

      <hr style={{ margin: "1rem 0", opacity: 0.1 }} />

      {/* ---------------- NOTES ---------------- */}
      <div
        contentEditable
        suppressContentEditableWarning
        onBlur={(e) => update("notes", e.target.innerText)}
        style={{
          padding: "0.6rem",
          borderRadius: "8px",
          background: "rgba(255,255,255,0.03)",
          cursor: "text",
          marginBottom: "1rem",
          minHeight: "60px",
        }}
      >
        {job.notes || "Click to add notes..."}
      </div>

      {/* ---------------- STATUS ---------------- */}
      <div style={{ marginBottom: "1rem" }}>
        <strong>Status:</strong>{" "}
        <select
          value={job.status}
          onChange={(e) => update("status", e.target.value)}
          style={{
            marginLeft: "0.5rem",
            padding: "0.4rem 0.6rem",
            borderRadius: "6px",
            background: "#1f1f2e",
            color: "#fff",
            border: "1px solid #444",
          }}
        >
          {[
            "Lead",
            "Contacted",
            "To-Quote",
            "Quoted",
            "Approved",
            "Booked",
            "In Progress",
            "Completed",
          ].map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </div>

      <hr style={{ margin: "1rem 0", opacity: 0.1 }} />

      {!job.phases || job.phases.length === 0 ? (
        <button onClick={() => navigate("QuoteBuilder", job.id)}>
          Build Quote
        </button>
      ) : (
        <button onClick={() => navigate("QuoteBuilder", job.id)}>
          Edit Quote
        </button>
      )}

      <hr style={{ margin: "1rem 0", opacity: 0.1 }} />

      {/* ---------------- Archive ---------------- */}
      {job.archived ? (
        <h1> ARCHIVED </h1>
      ) : (
        <button
          onClick={() => onArchive(job.id)}
          style={{
            background: "#ff4d4f",
            marginTop: "1rem",
            color: "#fff",
            border: "none",
            borderRadius: "4px",
            padding: "0.5rem 1rem",
            cursor: "pointer",
          }}
        >
          Archive Job
        </button>
      )}
    </div>
  );
}

export default JobOverview;
