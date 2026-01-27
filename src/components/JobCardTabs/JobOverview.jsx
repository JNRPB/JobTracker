import { useState } from "react";

function JobOverview({ job, onUpdate }) {
  const [localJobInfo, setLocalJobInfo] = useState(job);
  const [activeTab, setActiveTab] = useState(0);

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
      </div>
    </>
  );
}

export default JobOverview;
