import { useState, useEffect } from "react";

import Headbar from "./components/Headbar";
import Main from "./components/Main";
import { MainProvider } from "./components/Provider";
import PublicPortal from "./components/PublicPortal";
import PublicDocumentPage from "./components/PublicDocumentPage";

function normalizeJob(job) {
  return {
    ...job,

    customerDetails: job.customerDetails || {
      name: "",
      phone: "",
      email: "",
      address: job.address || "",
    },

    phases: job.phases || [],
    actualCosts: job.actualCosts || [],

    quotes: job.quotes || [],
    invoices: job.invoices || [],
    payments: job.payments || [],

    portal: job.portal || {
      enabled: false,
      token: null,
      activity: [],
    },
  };
}

function App() {
  const API_BASE = "";

  const publicPortalMatch = window.location.pathname.match(
    /^.*\/portal\/([^/]+)$/,
  );

  const publicPrintMatch = window.location.pathname.match(
    /^.*\/portal\/([^/]+)\/print\/(estimate|invoice)\/([^/]+)$/,
  );

  const publicEstimateMatch =
    window.location.pathname.match(/\/estimate\/([^/]+)$/);

  const publicInvoiceMatch =
    window.location.pathname.match(/\/invoice\/([^/]+)$/);

  const isPublicPage =
    publicPortalMatch ||
    publicEstimateMatch ||
    publicInvoiceMatch ||
    publicPrintMatch;

  const [jobs, setJobs] = useState([]);
  const [files, setFiles] = useState([]);
  const [unsortedFiles, setUnsortedFiles] = useState([]);

  const [navState, setNavState] = useState({
    history: [{ screen: "WelcomeScreen", data: {} }],
    index: 0,
  });

  const activeComponent = navState.history[navState.index].screen;
  const navData = navState.history[navState.index].data;

  function navigate(screen, data = {}) {
    setNavState((prev) => {
      const trimmedHistory = prev.history.slice(0, prev.index + 1);
      const newHistory = [...trimmedHistory, { screen, data }];

      return {
        history: newHistory,
        index: newHistory.length - 1,
      };
    });
  }

  function goBack() {
    setNavState((prev) => {
      if (prev.index === 0) return prev;

      return {
        ...prev,
        index: prev.index - 1,
      };
    });
  }

  function goForward() {
    setNavState((prev) => {
      if (prev.index >= prev.history.length - 1) return prev;

      return {
        ...prev,
        index: prev.index + 1,
      };
    });
  }

  async function refreshJobs() {
    try {
      const res = await fetch(`${API_BASE}/jobs`);
      const data = await res.json();

      const normalizedJobs = data.map(normalizeJob);

      setJobs(normalizedJobs);
      localStorage.setItem("jobs", JSON.stringify(normalizedJobs));
    } catch (err) {
      console.error("Error fetching jobs:", err);
    }
  }

  async function refreshFiles() {
    try {
      const res = await fetch(`${API_BASE}/api/files`);
      const data = await res.json();

      setFiles(data);
    } catch (err) {
      console.error("Failed to fetch files:", err);
    }
  }

  async function refreshUnsortedFiles() {
    try {
      const res = await fetch(`${API_BASE}/api/files/unsorted`);
      const data = await res.json();

      setUnsortedFiles(data);
    } catch (err) {
      console.error("Failed to fetch unsorted files:", err);
    }
  }

  useEffect(() => {
    if (isPublicPage) return;

    refreshJobs();
    refreshFiles();
    refreshUnsortedFiles();
  }, []);

  async function addJob(newJob) {
    try {
      const res = await fetch(`${API_BASE}/jobs`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(normalizeJob(newJob)),
      });

      const savedJob = normalizeJob(await res.json());

      const updatedJobs = [...jobs, savedJob];

      setJobs(updatedJobs);
      localStorage.setItem("jobs", JSON.stringify(updatedJobs));
    } catch (err) {
      console.error("Failed to create job:", err);
    }
  }

  function updateJobs(updatedJobs) {
    const normalizedJobs = updatedJobs.map(normalizeJob);

    setJobs(normalizedJobs);
    localStorage.setItem("jobs", JSON.stringify(normalizedJobs));
  }

  if (publicPrintMatch) {
    return (
      <PublicDocumentPage
        navData={{
          token: publicPrintMatch[1],
          type: publicPrintMatch[2],
          id: publicPrintMatch[3],
        }}
      />
    );
  }

  if (isPublicPage) {
    return (
      <PublicPortal
        navData={{
          token:
            publicPortalMatch?.[1] ||
            publicEstimateMatch?.[1] ||
            publicInvoiceMatch?.[1],
        }}
      />
    );
  }

  return (
    <div className="app-container">
      <Headbar
        navigate={navigate}
        activeComponent={activeComponent}
        goBack={goBack}
        goForward={goForward}
        canGoBack={navState.index > 0}
        canGoForward={navState.index < navState.history.length - 1}
      />

      <MainProvider>
        <Main
          activeComponent={activeComponent}
          addJob={addJob}
          jobs={jobs}
          navData={navData}
          setJobs={updateJobs}
          navigate={navigate}
          files={files}
          refreshFiles={refreshFiles}
          unsortedFiles={unsortedFiles}
          refreshUnsortedFiles={refreshUnsortedFiles}
        />
      </MainProvider>
    </div>
  );
}

export default App;

