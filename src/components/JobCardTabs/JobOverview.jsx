import { useState, useEffect } from "react";

const JOB_STATUSES = [
  "Lead",
  "Contacted",
  "To-Quote",
  "Quoted",
  "Approved",
  "Booked",
  "In Progress",
  "Completed",
];

function JobOverview({ job, onUpdate, deleteJob }) {
  const [localJobInfo, setLocalJobInfo] = useState(job);
  const [activeTab, setActiveTab] = useState(0);

  useEffect(() => {
    setLocalJobInfo(job);
  }, [job]);

  function commitChange(field, value) {
    const updatedJobInfo = {
      ...localJobInfo,
      [field]: value,
    };

    setLocalJobInfo(updatedJobInfo);

    if (onUpdate) onUpdate(updatedJobInfo);
  }

  function handleKeyDown(e) {
    if (e.key === "Enter") {
      e.preventDefault(); // prevents newline
      commitChange(e.target.innerText);
      e.target.blur();
    }
  }

  function handleBlur(e) {
    commitChange(e.target.innerText);
  }

  return (
    <>
      <div>
        <h1>Job Overview</h1>
      </div>
      <div className="bubbleBox">
        <h1
          contentEditable
          suppressContentEditableWarning={true}
          onBlur={(e) => commitChange("name", e.target.innerText)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commitChange("name", e.target.innerText);
              e.target.blur();
            }
          }}
          style={{
            cursor: "text",
          }}
        >
          {job.name}
        </h1>
        <h2>
          <strong>Address:</strong>
          <br />
          <span
            contentEditable
            suppressContentEditableWarning
            onBlur={(e) => commitChange("address", e.target.innerText)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commitChange("address", e.target.innerText);
                e.target.blur();
              }
            }}
          >
            {job.address}
          </span>
        </h2>
        <br></br>
        <br></br>
        <h2>
          <strong>Notes:</strong>
        </h2>
        <br></br>
        <p
          contentEditable
          suppressContentEditableWarning
          onBlur={(e) => commitChange("notes", e.target.innerText)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commitChange("notes", e.target.innerText);
              e.target.blur();
            }
          }}
        >
          {job.notes}
        </p>
        <br></br>
        <div style={{ marginTop: "1rem" }}>
          <strong>Status:</strong>

          <select
            value={localJobInfo.status}
            onChange={(e) => commitChange("status", e.target.value)}
            style={{
              marginLeft: "0.5rem",
              padding: "0.4rem",
              borderRadius: "6px",
            }}
          >
            {JOB_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </div>
        <br />
        <br />
        <br />
        {["Booked", "In Progress", "Completed"].includes(job.status) && (
          <div className="booking-details">
            <label>
              Date Scheduled to Start:
              <br />
              <input
                type="date"
                value={job.startDate || ""}
                onChange={(e) =>
                  onUpdate({ ...job, startDate: e.target.value })
                }
              />
            </label>
            <br />
            <br />
            <label>
              Date Scheduled to Finish:
              <br />
              <input
                type="date"
                value={job.finishDate || ""}
                onChange={(e) =>
                  onUpdate({ ...job, finishDate: e.target.value })
                }
              />
            </label>
            <br />
            <br />
            <label>
              Agreed Price:
              <br />
              <input
                type="number"
                value={job.agreedPrice || ""}
                onChange={(e) =>
                  onUpdate({ ...job, agreedPrice: Number(e.target.value) })
                }
              />
            </label>
          </div>
        )}
        <button
          style={{
            backgroundColor: "red",
            color: "#fff",
            border: "none",
            borderRadius: "4px",
            padding: "0.5rem 1rem",
            cursor: "pointer",
            marginTop: "1rem",
          }}
          onClick={() => deleteJob(job.id)}
        >
          Delete Job
        </button>
      </div>
    </>
  );
}

export default JobOverview;
