import { useState, useEffect } from "react";

function JobOverview({
  job,
  onUpdate,
  onArchive,
  onUnarchive,
  navigate,
  jobFiles = [],
  fileCount = 0,
  fileLinkedCost = 0,
}) {
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

  const quoteTotal = Number(localJob.quoteTotal || 0);
  const costTotal = Number(fileLinkedCost || 0);
  const margin = quoteTotal - costTotal;
  const hasQuote = localJob.phases && localJob.phases.length > 0;

  const summaryBoxStyle = {
    marginBottom: "1rem",
    padding: "0.75rem",
    borderRadius: "8px",
    background: "rgba(255,255,255,0.03)",
  };

  const inputStyle = {
    marginLeft: "0.5rem",
    padding: "0.4rem 0.6rem",
    borderRadius: "6px",
    background: "#1f1f2e",
    color: "#fff",
    border: "1px solid #444",
  };

  const marginBoxStyle = {
    marginBottom: "1rem",
    padding: "0.75rem",
    borderRadius: "8px",
    background:
      margin >= 0 ? "rgba(82, 196, 26, 0.12)" : "rgba(255, 77, 79, 0.12)",
    border:
      margin >= 0
        ? "1px solid rgba(82, 196, 26, 0.35)"
        : "1px solid rgba(255, 77, 79, 0.35)",
    color: margin >= 0 ? "#b7eb8f" : "#ff9c9c",
    fontWeight: "600",
  };

  return (
    <div className="bubbleBox2">
      <h1
        contentEditable
        suppressContentEditableWarning
        onBlur={(e) => update("name", e.target.innerText)}
        style={{ cursor: "text", marginBottom: "0.3rem" }}
      >
        {localJob.name}
      </h1>

      <p
        contentEditable
        suppressContentEditableWarning
        onBlur={(e) => update("address", e.target.innerText)}
        style={{ opacity: 0.8, cursor: "text" }}
      >
        {localJob.address}
      </p>

      <hr style={{ margin: "1rem 0", opacity: 0.1 }} />

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
          textAlign: "left",
        }}
      >
        {localJob.notes || "Click to add notes..."}
      </div>

      <div style={{ marginBottom: "1rem" }}>
        <strong>Status:</strong>
        <select
          value={localJob.status}
          onChange={(e) => update("status", e.target.value)}
          style={inputStyle}
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

      <div style={{ marginBottom: "1rem" }}>
        <strong>Start Date:</strong>
        <input
          type="date"
          value={localJob.startDate || ""}
          onChange={(e) => update("startDate", e.target.value)}
          style={inputStyle}
        />
      </div>

      <div style={summaryBoxStyle}>
        <strong>Quote Total:</strong> £{quoteTotal.toFixed(2)}
      </div>

      <div style={summaryBoxStyle}>
        <strong>Files Logged:</strong> {fileCount}
      </div>

      <div style={summaryBoxStyle}>
        <strong>File-linked Cost:</strong> £{costTotal.toFixed(2)}
      </div>

      <div style={marginBoxStyle}>
        <strong>Margin:</strong> £{margin.toFixed(2)}
      </div>

      <hr style={{ margin: "1rem 0", opacity: 0.1 }} />

      <button onClick={() => navigate("QuoteBuilder", { jobId: localJob.id })}>
        {hasQuote ? "Edit Quote" : "Add Quote"}
      </button>

      <hr style={{ margin: "1rem 0", opacity: 0.1 }} />

      {localJob.archived ? (
        <button
          onClick={() => onUnarchive(localJob.id)}
          style={{
            background: "#52c41a",
            marginTop: "1rem",
            color: "#fff",
            border: "none",
            borderRadius: "4px",
            padding: "0.5rem 1rem",
            cursor: "pointer",
          }}
        >
          Unarchive Job
        </button>
      ) : (
        <button
          onClick={() => onArchive(localJob.id)}
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
