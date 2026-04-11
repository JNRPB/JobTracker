import CreateJob from "./CreateJob";
import JobCard from "./JobCard";
import NoJob from "./WelcomeScreen";
import JobStatusOverview from "./JobStatusOverview";
import MonthlyCashflow from "./MonthlyCashflow";
import WelcomeScreen from "./WelcomeScreen";
import ArchivedJobs from "./JobCardTabs/ArchivedJobs";

function Main({
  activeComponent,
  addJob,
  activeJobId,
  jobs,
  setJobs,
  setActiveComponent,
  setActiveJobId,
}) {
  const job = jobs.find((j) => j.id === activeJobId);

  window.jobs = jobs;

  // Update a single job + persist via App & Server
  async function updateJob(updatedJob) {
    const updatedJobs = jobs.map((j) =>
      j.id === updatedJob.id ? updatedJob : j,
    );

    setJobs(updatedJobs);
    localStorage.setItem("jobs", JSON.stringify(updatedJobs));

    // Send update to backend
    try {
      const response = await fetch(
        `http://192.168.0.22:3001/jobs/${updatedJob.id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(updatedJob),
        },
      );

      if (!response.ok) {
        console.error("Failed to update job on server", response.statusText);
      } else {
        console.log("Job successfully updated on server");
      }
    } catch (err) {
      console.error("Error updating job on server:", err);
    }
  }

  // Delete a job + persist server also
  async function deleteJob(jobId) {
    const updatedJobs = jobs.filter((j) => j.id !== jobId);
    setJobs(updatedJobs);
    localStorage.setItem("jobs", JSON.stringify(updatedJobs));

    try {
      const response = await fetch(`http://192.168.0.22:3001/jobs/${jobId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        console.error("Failed to delete job on server", response.statusText);
      } else {
        console.log("Job successfully deleted on server");
      }
    } catch (err) {
      console.error("Error deleting job on server:", err);
    }
  }

  async function archiveJob(jobId) {
    await fetch(`http://192.168.0.22:3001/jobs/${jobId}/archive`, {
      method: "PUT",
    });

    const res = await fetch("http://192.168.0.22:3001/jobs");
    const data = await res.json();

    setJobs(data);
  }
  // Render exactly one component based on activeComponent
  function renderActiveComponent() {
    switch (activeComponent) {
      case "CreateJob":
        return (
          <CreateJob
            addJob={addJob}
            setActiveJobId={setActiveJobId}
            setActiveComponent={setActiveComponent}
          />
        );

      case "JobCard":
        if (!job) return <WelcomeScreen />; // fallback if job is deleted or null
        return (
          <JobCard
            job={job}
            onUpdate={updateJob}
            deleteJob={deleteJob}
            key={job.id}
            onArchive={archiveJob}
          />
        );

      case "JobStatusOverview":
        return (
          <JobStatusOverview
            jobs={jobs}
            setActiveComponent={setActiveComponent}
            setActiveJobId={setActiveJobId}
          />
        );

      case "MonthlyCashflow":
        return (
          <MonthlyCashflow
            jobs={jobs}
            setActiveComponent={setActiveComponent}
            setActiveJobId={setActiveJobId}
          />
        );

      case "ArchivedJobs":
        return (
          <ArchivedJobs
            jobs={jobs}
            setActiveComponent={setActiveComponent}
            setActiveJobId={setActiveJobId}
          />
        );

      case "WelcomeScreen":
      default:
        return <WelcomeScreen />;
    }
  }

  return <div className="main-panel">{renderActiveComponent()}</div>;
}

export default Main;
