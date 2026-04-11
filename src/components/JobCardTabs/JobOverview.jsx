import { useState, useEffect } from "react";

function JobOverview({ job, jobs, onUpdate, deleteJob, onArchive }) {
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
    <div className="eBox">
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

      {/* ---------------- DATES + PRICE ---------------- */}
      {["Booked", "In Progress", "Completed"].includes(job.status) && (
        <div style={{ marginBottom: "1rem", opacity: 0.9 }}>
          <div style={{ marginBottom: "0.5rem" }}>
            <strong>Start:</strong>{" "}
            <input
              type="date"
              value={job.startDate || ""}
              onChange={(e) => update("startDate", e.target.value)}
              style={{
                marginLeft: "0.5rem",
                background: "#1f1f2e",
                color: "#fff",
                border: "1px solid #444",
                borderRadius: "6px",
                padding: "0.3rem",
              }}
            />
          </div>

          <div style={{ marginBottom: "0.5rem" }}>
            <strong>Finish:</strong>{" "}
            <input
              type="date"
              value={job.finishDate || ""}
              onChange={(e) => update("finishDate", e.target.value)}
              style={{
                marginLeft: "0.5rem",
                background: "#1f1f2e",
                color: "#fff",
                border: "1px solid #444",
                borderRadius: "6px",
                padding: "0.3rem",
              }}
            />
          </div>

          <div>
            <strong>Price:</strong>{" "}
            <input
              type="number"
              value={job.agreedPrice || ""}
              onChange={(e) => update("agreedPrice", Number(e.target.value))}
              style={{
                marginLeft: "0.5rem",
                background: "#1f1f2e",
                color: "#fff",
                border: "1px solid #444",
                borderRadius: "6px",
                padding: "0.3rem",
              }}
            />
          </div>
        </div>
      )}

      <hr style={{ margin: "1rem 0", opacity: 0.1 }} />

      {/* ---------------- PHASES ---------------- */}
      <h3>Phases</h3>

      {job.phases?.map((phase) => {
        const expectedTotal = phase.rows?.reduce(
          (sum, row) =>
            sum + Number(row.materialCost || 0) + Number(row.labourCost || 0),
          0,
        );

        const actualTotal = job.actualCosts?.reduce(
          (sum, row) =>
            sum + (row.phaseId === phase.id ? Number(row.cost || 0) : 0),
          0,
        );

        const remaining = expectedTotal - actualTotal;

        return (
          <div
            key={phase.id}
            style={{
              padding: "0.6rem",
              marginBottom: "0.6rem",
              borderRadius: "8px",
              background: "rgba(255,255,255,0.03)",
            }}
          >
            <strong>{phase.name}</strong>
            <div style={{ opacity: 0.8, fontSize: "0.9rem" }}>
              £{expectedTotal.toFixed(2)} • £{remaining.toFixed(2)} remaining
            </div>
          </div>
        );
      })}

      <hr style={{ margin: "1rem 0", opacity: 0.1 }} />

      {/* ---------------- COST SUMMARY ---------------- */}
      <h3>Cost Summary</h3>

      {(() => {
        const phases = job.phases || [];
        const actualCosts = job.actualCosts || [];

        const totalExpected = phases.reduce(
          (sumPhase, phase) =>
            sumPhase +
            (phase.rows?.reduce(
              (sumRow, row) =>
                sumRow +
                Number(row.materialCost || 0) +
                Number(row.labourCost || 0),
              0,
            ) || 0),
          0,
        );

        const totalActual = actualCosts.reduce(
          (sum, row) => sum + Number(row.cost || 0),
          0,
        );

        const remaining = totalExpected - totalActual;

        return (
          <div style={{ lineHeight: "1.6" }}>
            <div>
              <strong>Quoted:</strong> £{totalExpected.toFixed(2)}
            </div>
            <div>
              <strong>Actual:</strong> £{totalActual.toFixed(2)}
            </div>
            <div>
              <strong>Remaining:</strong> £{remaining.toFixed(2)}
            </div>
          </div>
        );
      })()}

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
