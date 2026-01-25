import { useState } from "react";
import JobOverview from "./JobCardTabs/JobOverview";

function JobCard({ job, onUpdate }) {
  const [activeTab, setActiveTab] = useState(0);

  return (
    <>{activeTab === 0 && <JobOverview job={job} onUpdate={onUpdate} />}</>
  );
}

export default JobCard;
