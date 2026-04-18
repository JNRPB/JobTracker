import { useState, useEffect } from "react";

function JobOverview({
  job,
  onUpdate,
  deleteJob,
  onArchive,
  onUnarchive,
  navigate,
  invoices,
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

  const allocatedInvoiceTotal = invoices.reduce((sum, invoice) => {
    if (!invoice.jobLinks || invoice.jobLinks.length === 0) return sum;

    const matchingLinks = invoice.jobLinks.filter(
      (link) => link.jobId === localJob.id,
    );

    const invoiceTotalForThisJob = matchingLinks.reduce((linkSum, link) => {
      return linkSum + Number(link.amount || 0);
    }, 0);

    return sum + invoiceTotalForThisJob;
  }, 0);

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
        }}
      >
        {localJob.notes || "Click to add notes..."}
      </div>

      <div style={{ marginBottom: "1rem" }}>
        <strong>Status:</strong>{" "}
        <select
          value={localJob.status}
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

      <div style={{ marginBottom: "1rem" }}>
        <strong>Start Date:</strong>{" "}
        <input
          type="date"
          value={localJob.startDate || ""}
          onChange={(e) => update("startDate", e.target.value)}
          style={{
            marginLeft: "0.5rem",
            padding: "0.4rem 0.6rem",
            borderRadius: "6px",
            background: "#1f1f2e",
            color: "#fff",
            border: "1px solid #444",
          }}
        />
      </div>

      <div
        style={{
          marginBottom: "1rem",
          padding: "0.75rem",
          borderRadius: "8px",
          background: "rgba(255,255,255,0.03)",
        }}
      >
        <strong>Quote Total:</strong> £
        {Number(localJob.quoteTotal || 0).toFixed(2)}
      </div>

      <div
        style={{
          marginBottom: "1rem",
          padding: "0.75rem",
          borderRadius: "8px",
          background: "rgba(255,255,255,0.03)",
        }}
      >
        <strong>Allocated Invoice Total:</strong> £
        {allocatedInvoiceTotal.toFixed(2)}
      </div>

      <hr style={{ margin: "1rem 0", opacity: 0.1 }} />

      {!localJob.phases || localJob.phases.length === 0 ? (
        <button
          onClick={() => navigate("QuoteBuilder", { jobId: localJob.id })}
        >
          Build Quote
        </button>
      ) : (
        <button
          onClick={() => navigate("QuoteBuilder", { jobId: localJob.id })}
        >
          Edit Quote
        </button>
      )}

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
