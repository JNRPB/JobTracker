import { useState } from "react";
import JobOverview from "./JobCardTabs/JobOverview";
import ExpectedCost from "./JobCardTabs/ExpectedCost";
import ActualCost from "./JobCardTabs/ActualCost";

function JobCard({ job, onUpdate, deleteJob, onArchive }) {
  const [activeTab, setActiveTab] = useState(0);
  const [editingExpectedCost, setEditingExpectedCost] = useState(false);
  const [editingActualCost, setEditingActualCost] = useState(false);
  const [editingJobDetails, setEditingJobDetails] = useState(false);

  function handleDeleteJob() {
    removeJob(job.id);
  }

  return (
    <>
      {activeTab === 0 && (
        <JobOverview
          job={job}
          onUpdate={onUpdate}
          deleteJob={deleteJob}
          editing={editingJobDetails}
          setEditing={setEditingJobDetails}
          onArchive={onArchive}
        />
      )}
      {activeTab === 1 && (
        <ExpectedCost
          job={job}
          onUpdate={onUpdate}
          editing={editingExpectedCost}
          setEditing={setEditingExpectedCost}
        />
      )}

      {activeTab === 2 && (
        <ActualCost
          job={job}
          onUpdate={onUpdate}
          editing={editingActualCost}
          setEditing={setEditingActualCost}
        />
      )}
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
