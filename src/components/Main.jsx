import CreateJob from "./CreateJob";
import JobCard from "./JobCard";
import NoJob from "./NoJob";

function Main({ activeComponent, addJob, activeJobId, jobs, setJobs }) {
  const job = jobs.find((j) => j.id === activeJobId);

  function updateJob(updatedJob) {
    setJobs(jobs.map((j) => (j.id === updatedJob.id ? updatedJob : j)));
  }

  return (
    <div className="main-panel">
      {activeComponent === "CreateJob" && <CreateJob addJob={addJob} />}
      {job && activeComponent !== "CreateJob" && (
        <JobCard job={job} onUpdate={updateJob} key={job.id} />
      )}
      {activeComponent === "NoJob" && <NoJob />}
    </div>
  );
}

export default Main;
