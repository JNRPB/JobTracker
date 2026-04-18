import CreateJob from "./CreateJob";
import JobCard from "./JobCard";
import QuoteBuilder from "./QuoteBuilder";
import JobStatusOverview from "./JobStatusOverview";
import WelcomeScreen from "./WelcomeScreen";
import ArchivedJobs from "./JobCardTabs/ArchivedJobs";
import Transactions from "./Transactions";
import Invoices from "./Invoices";
import LogInvoice from "./LogInvoice";
import EditInvoice from "./EditInvoice";

function Main({
  activeComponent,
  addJob,
  navData,
  jobs,
  setJobs,
  navigate,
  addInvoice,
  invoices,
  updateInvoice,
  deleteInvoice,
}) {
  const job = jobs.find((j) => j.id === navData.jobId);

  window.jobs = jobs;

  async function updateJob(updatedJob) {
    const updatedJobs = jobs.map((j) =>
      j.id === updatedJob.id ? updatedJob : j,
    );

    setJobs(updatedJobs);
    localStorage.setItem("jobs", JSON.stringify(updatedJobs));

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
    try {
      await fetch(`http://192.168.0.22:3001/jobs/${jobId}/archive`, {
        method: "PUT",
      });

      const res = await fetch("http://192.168.0.22:3001/jobs");
      const data = await res.json();

      setJobs(data);
      localStorage.setItem("jobs", JSON.stringify(data));
    } catch (err) {
      console.error("Error archiving job:", err);
    }
  }

  async function unarchiveJob(jobId) {
    try {
      await fetch(`http://192.168.0.22:3001/jobs/${jobId}/unarchive`, {
        method: "PUT",
      });

      const res = await fetch("http://192.168.0.22:3001/jobs");
      const data = await res.json();

      setJobs(data);
      localStorage.setItem("jobs", JSON.stringify(data));
    } catch (err) {
      console.error("Error unarchiving job:", err);
    }
  }

  function renderActiveComponent() {
    switch (activeComponent) {
      case "CreateJob":
        return <CreateJob addJob={addJob} navigate={navigate} />;

      case "JobCard":
        if (!job) return <WelcomeScreen jobs={jobs} />;
        return (
          <JobCard
            key={job.id}
            job={job}
            onUpdate={updateJob}
            deleteJob={deleteJob}
            onArchive={archiveJob}
            onUnarchive={unarchiveJob}
            navigate={navigate}
            invoices={invoices}
          />
        );

      case "JobStatusOverview":
        return (
          <JobStatusOverview
            jobs={jobs}
            navigate={navigate}
            invoices={invoices}
          />
        );

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
        return <Transactions jobs={jobs} navigate={navigate} />;

      case "Invoices":
        return (
          <Invoices
            jobs={jobs}
            invoices={invoices}
            navigate={navigate}
            deleteInvoice={deleteInvoice}
          />
        );

      case "LogInvoice":
        return (
          <LogInvoice addInvoice={addInvoice} navigate={navigate} jobs={jobs} />
        );

      case "EditInvoice":
        return (
          <EditInvoice
            invoices={invoices}
            jobs={jobs}
            navData={navData}
            updateInvoice={updateInvoice}
            navigate={navigate}
          />
        );

      case "WelcomeScreen":
      default:
        return <WelcomeScreen jobs={jobs} />;
    }
  }

  return <div className="main-panel">{renderActiveComponent()}</div>;
}

export default Main;
