import { useEffect, useMemo, useState } from "react";
import JobOverview from "./JobCardTabs/JobOverview";

const API_BASE = "";

function JobCard({
  job,
  onUpdate,
  deleteJob,
  onArchive,
  onUnarchive,
  navigate,
}) {
  const [jobFiles, setJobFiles] = useState([]);

  async function fetchJobFiles() {
    if (!job?.id) return;

    try {
      const res = await fetch(`${API_BASE}/api/files/job/${job.id}`);
      const data = await res.json();

      setJobFiles(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to fetch job files:", err);
    }
  }

  useEffect(() => {
    fetchJobFiles();
  }, [job?.id]);

  function getLinksForThisJob(file) {
    return (
      file.links?.filter(
        (link) =>
          link.targetType === "job" && String(link.targetId) === String(job.id),
      ) || []
    );
  }

  const flattenedJobFiles = useMemo(() => {
    return jobFiles.flatMap((file) => {
      const links = getLinksForThisJob(file);

      return links.map((link, index) => ({
        id: `${file.id}-${index}`,
        file,
        link,
        cost: Number(link.cost || 0),
      }));
    });
  }, [jobFiles, job?.id]);

  const fileLinkedCost = flattenedJobFiles.reduce((sum, item) => {
    return sum + Number(item.cost || 0);
  }, 0);

  const fileCount = jobFiles.length;

  return (
    <JobOverview
      job={job}
      onUpdate={onUpdate}
      deleteJob={deleteJob}
      onArchive={onArchive}
      onUnarchive={onUnarchive}
      navigate={navigate}
      jobFiles={jobFiles}
      fileCount={fileCount}
      fileLinkedCost={fileLinkedCost}
    />
  );
}

export default JobCard;

