import { useState } from "react";
import JobOverview from "./JobCardTabs/JobOverview";
import ExpectedCost from "./JobCardTabs/ExpectedCost";

function JobCard({ job, onUpdate }) {
  const [activeTab, setActiveTab] = useState(0);

  return (
    <>
      {activeTab === 0 && <JobOverview job={job} onUpdate={onUpdate} />}
      {activeTab === 1 && <ExpectedCost job={job} onUpdate={onUpdate} />}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: "10px",
        }}
      >
        <button
          disabled={activeTab === 0}
          onClick={() => setActiveTab(activeTab - 1)}
        >
          ◀
        </button>

        <button
          disabled={activeTab === 2}
          onClick={() => setActiveTab(activeTab + 1)}
        >
          ▶
        </button>
      </div>
    </>
  );
}

export default JobCard;
