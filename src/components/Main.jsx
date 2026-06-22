import CreateJob from "./CreateJob";
import JobCard from "./JobCard";
import QuoteBuilder from "./QuoteBuilder";
import JobStatusOverview from "./JobStatusOverview";
import WelcomeScreen from "./WelcomeScreen";
import ArchivedJobs from "./JobCardTabs/ArchivedJobs";
import Transactions from "./Transactions";
import Files from "./Files";
import UnsortedFiles from "./UnsortedFiles";
import SpendCalendar from "./SpendCalendar";
import JobHeatMap from "./JobHeatMap";
import BusinessFacts from "./BusinessFacts";
import ForecastPage from "./ForecastPage";

const API_BASE = "http://100.68.229.104:3001";

function Main({
  activeComponent,
  addJob,
  navData,
  jobs,
  setJobs,
  navigate,
  files,
  refreshFiles,
  unsortedFiles,
  refreshUnsortedFiles,
}) {
  const job = jobs.find((j) => String(j.id) === String(navData.jobId));

  async function updateJob(updatedJob) {
    const updatedJobs = jobs.map((j) =>
      j.id === updatedJob.id ? updatedJob : j,
    );

    setJobs(updatedJobs);

    try {
      const response = await fetch(`${API_BASE}/jobs/${updatedJob.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updatedJob),
      });

      if (!response.ok) {
        console.error("Failed to update job on server", response.statusText);
      }
    } catch (err) {
      console.error("Error updating job on server:", err);
    }
  }

  async function deleteJob(jobId) {
    const updatedJobs = jobs.filter((j) => j.id !== jobId);
    setJobs(updatedJobs);

    try {
      const response = await fetch(`${API_BASE}/jobs/${jobId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        console.error("Failed to delete job on server", response.statusText);
      }
    } catch (err) {
      console.error("Error deleting job on server:", err);
    }
  }

  async function archiveJob(jobId) {
    try {
      await fetch(`${API_BASE}/jobs/${jobId}/archive`, {
        method: "PUT",
      });

      const res = await fetch(`${API_BASE}/jobs`);
      const data = await res.json();

      setJobs(data);
    } catch (err) {
      console.error("Error archiving job:", err);
    }
  }

  async function unarchiveJob(jobId) {
    try {
      await fetch(`${API_BASE}/jobs/${jobId}/unarchive`, {
        method: "PUT",
      });

      const res = await fetch(`${API_BASE}/jobs`);
      const data = await res.json();

      setJobs(data);
    } catch (err) {
      console.error("Error unarchiving job:", err);
    }
  }

  function renderActiveComponent() {
    switch (activeComponent) {
      case "CreateJob":
        return <CreateJob addJob={addJob} navigate={navigate} />;

      case "JobCard":
        if (!job) {
          return (
            <WelcomeScreen
              jobs={jobs}
              files={files}
              unsortedFiles={unsortedFiles}
              navigate={navigate}
            />
          );
        }

        return (
          <JobCard
            key={job.id}
            job={job}
            onUpdate={updateJob}
            deleteJob={deleteJob}
            onArchive={archiveJob}
            onUnarchive={unarchiveJob}
            navigate={navigate}
            files={files}
          />
        );

      case "JobStatusOverview":
        return (
          <JobStatusOverview jobs={jobs} navigate={navigate} files={files} />
        );

      case "BusinessFacts":
        return <BusinessFacts />;

      case "QuoteBuilder":
        return (
          <QuoteBuilder
            navData={navData}
            navigate={navigate}
            jobs={jobs}
            onUpdate={updateJob}
          />
        );

      case "ArchivedJobs":
        return (
          <ArchivedJobs
            jobs={jobs}
            navigate={navigate}
            onUnarchive={unarchiveJob}
          />
        );

      case "Transactions":
        return <Transactions jobs={jobs} navigate={navigate} files={files} />;
      case "SpendCalendar":
        return <SpendCalendar jobs={jobs} />;
      case "JobHeatMap":
        return <JobHeatMap jobs={jobs} navigate={navigate} />;
      case "Files":
        return (
          <Files
            files={files}
            jobs={jobs}
            navigate={navigate}
            refreshFiles={refreshFiles}
            navData={navData}
          />
        );

      case "UnsortedFiles":
        return (
          <UnsortedFiles
            unsortedFiles={unsortedFiles}
            refreshUnsortedFiles={refreshUnsortedFiles}
            refreshFiles={refreshFiles}
            navigate={navigate}
            jobs={jobs}
          />
        );

      case "ForecastPage":
        return <ForecastPage jobs={jobs} />;

      case "WelcomeScreen":
      default:
        return (
          <WelcomeScreen
            jobs={jobs}
            files={files}
            unsortedFiles={unsortedFiles}
            navigate={navigate}
          />
        );
    }
  }

  return <div className="main-panel">{renderActiveComponent()}</div>;
}

export default Main;
