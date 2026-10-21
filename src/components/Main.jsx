import { useEffect, useState } from "react";
import CreateJob from "./CreateJob";
import JobCard from "./JobCard";
import QuoteBuilder from "./QuoteBuilder";
import InvoiceBuilder from "./InvoiceBuilder";
import JobDocuments from "./JobDocuments";
import PricingNotesPage from "./PricingNotesPage";
import JobStatusOverview from "./JobStatusOverview";
import WelcomeScreen from "./WelcomeScreen";
import Transactions from "./Transactions";
import Files from "./Files";
import UnsortedFiles from "./UnsortedFiles";
import SpendCalendar from "./SpendCalendar";
import JobHeatMap from "./JobHeatMap";
import BusinessFacts from "./BusinessFacts";
import ForecastPage from "./ForecastPage";
import Settings from "./Settings";
import TodoPage from "./TodoPage";
import SchedulePage from "./SchedulePage";
import ResourceProfile from "./ResourceProfile";
import TeamHome from "./TeamHome";
import MyProfile from "./MyProfile";
import { canAccessScreen } from "./access";

const API_BASE = "";

function Main({
  activeComponent,
  addJob,
  navData = {},
  jobs = [],
  setJobs,
  navigate,
  files = [],
  refreshFiles,
  unsortedFiles = [],
  refreshUnsortedFiles,
  refreshJobs,
  onSettingsDirtyChange,
  currentUser,
  onCurrentUserChange,
}) {
  const [sessionUser, setSessionUser] = useState(currentUser || null);
  const [checkingAccess, setCheckingAccess] = useState(!currentUser);
  const accessUser = currentUser || sessionUser;
  const job = jobs.find((item) => String(item.id) === String(navData.jobId));

  useEffect(() => {
    if (currentUser) {
      setSessionUser(currentUser);
      setCheckingAccess(false);
      return undefined;
    }

    let cancelled = false;
    setCheckingAccess(true);

    fetch(`${API_BASE}/api/auth/me`, { credentials: "include" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Could not confirm this HQ session.");
        const data = await response.json();
        if (!cancelled) setSessionUser(data.user || null);
      })
      .catch(() => {
        if (!cancelled) setSessionUser(null);
      })
      .finally(() => {
        if (!cancelled) setCheckingAccess(false);
      });

    return () => {
      cancelled = true;
    };
  }, [currentUser]);

  async function updateJob(updatedJob) {
    const response = await fetch(`${API_BASE}/jobs/${updatedJob.id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(updatedJob),
    });

    if (!response.ok) {
      throw new Error(`Could not update job (${response.status}).`);
    }

    const data = await response.json();
    const savedJob = data.job || data;

    setJobs(
      jobs.map((item) =>
        String(item.id) === String(savedJob.id) ? savedJob : item,
      ),
    );

    return savedJob;
  }

  async function deleteJob(jobId) {
    const response = await fetch(`${API_BASE}/jobs/${jobId}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      throw new Error(`Could not delete job (${response.status}).`);
    }

    setJobs(jobs.filter((item) => String(item.id) !== String(jobId)));
  }

  async function refreshJobsFromServer() {
    const response = await fetch(`${API_BASE}/jobs`);

    if (!response.ok) {
      throw new Error(`Could not refresh jobs (${response.status}).`);
    }

    const data = await response.json();
    setJobs(Array.isArray(data) ? data : []);
    return data;
  }

  async function setArchivedState(jobId, archived) {
    const endpoint = archived ? "archive" : "unarchive";
    const response = await fetch(`${API_BASE}/jobs/${jobId}/${endpoint}`, {
      method: "PUT",
    });

    if (!response.ok) {
      throw new Error(
        `Could not ${archived ? "archive" : "unarchive"} job (${response.status}).`,
      );
    }

    const data = await response.json();
    const savedJob = data.job;

    if (!savedJob) {
      await refreshJobsFromServer();
      return null;
    }

    setJobs(
      jobs.map((item) =>
        String(item.id) === String(savedJob.id) ? savedJob : item,
      ),
    );

    return savedJob;
  }

  function archiveJob(jobId) {
    return setArchivedState(jobId, true);
  }

  function unarchiveJob(jobId) {
    return setArchivedState(jobId, false);
  }

  function renderWelcome() {
    return (
      <WelcomeScreen
        jobs={jobs}
        files={files}
        currentUser={accessUser}
        unsortedFiles={unsortedFiles}
        navigate={navigate}
      />
    );
  }

  function renderJobCard() {
    if (!job) return renderWelcome();

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
        currentUser={accessUser}
      />
    );
  }

  function renderActiveComponent() {
    if (checkingAccess && !accessUser) {
      return (
        <section className="settingsPage">
          <article className="settingsCard">
            <h3>Checking access…</h3>
            <p>Confirming your JNR HQ account.</p>
          </article>
        </section>
      );
    }

    if (!canAccessScreen(accessUser, activeComponent)) {
      return (
        <section className="settingsPage">
          <article className="settingsCard">
            <h3>Access not available</h3>
            <p>Your JNR HQ account does not have access to this section.</p>
          </article>
        </section>
      );
    }

    switch (activeComponent) {
      case "CreateJob":
        return <CreateJob addJob={addJob} navigate={navigate} />;

      case "JobCard":
        return renderJobCard();

      case "TeamHome":
        return (
          <TeamHome
            jobs={jobs}
            currentUser={accessUser}
            onRefresh={refreshJobs}
          />
        );

      case "MyProfile":
        return (
          <MyProfile
            currentUser={accessUser}
            onCurrentUserChange={(user) => {
              setSessionUser(user);
              onCurrentUserChange?.(user);
            }}
            navigate={navigate}
          />
        );

      case "SchedulePage":
        return (
          <SchedulePage
            jobs={jobs}
            navigate={navigate}
            currentUser={accessUser}
            initialJobId={navData.jobId}
          />
        );

      case "ResourceProfile":
        return (
          <ResourceProfile
            resourceId={navData.resourceId}
            navigate={navigate}
            currentUser={accessUser}
          />
        );

      case "JobDocuments":
        return (
          <JobDocuments job={job} navigate={navigate} onUpdate={updateJob} />
        );

      case "PricingNotesPage":
        if (!job) return renderWelcome();
        return (
          <PricingNotesPage
            job={job}
            navigate={navigate}
            onUpdate={updateJob}
          />
        );

      case "JobStatusOverview":
        return (
          <JobStatusOverview
            jobs={jobs}
            navigate={navigate}
            files={files}
            onUnarchive={unarchiveJob}
          />
        );

      case "TodoPage":
        return (
          <TodoPage
            jobs={jobs}
            navigate={navigate}
            onUpdate={updateJob}
            initialJobId={navData.jobId}
          />
        );

      case "BusinessFacts":
        return <BusinessFacts navigate={navigate} />;

      case "QuoteBuilder":
        return (
          <QuoteBuilder
            navData={navData}
            navigate={navigate}
            jobs={jobs}
            onUpdate={updateJob}
          />
        );

      case "InvoiceBuilder":
        return (
          <InvoiceBuilder
            navData={navData}
            navigate={navigate}
            jobs={jobs}
            files={files}
            onUpdate={updateJob}
          />
        );

      case "ArchivedJobs":
        return (
          <JobStatusOverview
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
        return <JobHeatMap jobs={jobs} navigate={navigate} navData={navData} />;

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

      case "Settings":
        return (
          <Settings
            files={files}
            onDirtyChange={onSettingsDirtyChange}
            currentUser={accessUser}
            onCurrentUserChange={(user) => {
              setSessionUser(user);
              onCurrentUserChange?.(user);
            }}
            navigate={navigate}
          />
        );

      case "WelcomeScreen":
      default:
        return renderWelcome();
    }
  }

  return <div className="main-panel">{renderActiveComponent()}</div>;
}

export default Main;
