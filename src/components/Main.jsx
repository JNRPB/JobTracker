import CreateJob from "./CreateJob";
import JobCard from "./JobCard";
import NoJob from "./NoJob";
import Homepage from "./Homepage";

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

  // Update a single job + persist via App
  function updateJob(updatedJob) {
    const updatedJobs = jobs.map((j) =>
      j.id === updatedJob.id ? updatedJob : j,
    );
    setJobs(updatedJobs);
    localStorage.setItem("jobs", JSON.stringify(updatedJobs));
  }

  // Delete a job + persist
  function deleteJob(jobId) {
    const updatedJobs = jobs.filter((j) => j.id !== jobId);
    setJobs(updatedJobs);
    localStorage.setItem("jobs", JSON.stringify(updatedJobs));
  }

  // Render exactly one component based on activeComponent
  function renderActiveComponent() {
    switch (activeComponent) {
      case "CreateJob":
        return <CreateJob addJob={addJob} />;

      case "JobCard":
        if (!job) return <NoJob />; // fallback if job is deleted or null
        return (
          <JobCard
            job={job}
            onUpdate={updateJob}
            deleteJob={deleteJob}
            key={job.id}
          />
        );

      case "Homepage":
        return (
          <Homepage
            jobs={jobs}
            setActiveComponent={setActiveComponent}
            setActiveJobId={setActiveJobId}
          />
        );

      case "NoJob":
      default:
        return <NoJob />;
    }
  }

  return <div className="main-panel">{renderActiveComponent()}</div>;
}

export default Main;
