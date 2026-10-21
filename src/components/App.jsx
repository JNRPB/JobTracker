import { useState, useEffect } from "react";

import Headbar from "./components/Headbar";
import Main from "./components/Main";
import Login from "./components/Login";
import { MainProvider } from "./components/Provider";
import PublicPortal from "./components/PublicPortal";
import PublicDocumentPage from "./components/PublicDocumentPage";
import {
  canAccessScreen,
  defaultScreenForUser,
} from "./components/access";

function normalizeJob(job) {
  const existingCustomer = job.customerDetails || {};

  const clientName =
    job.clientName || job.client || existingCustomer.name || "";
  const clientPhone = job.clientPhone || existingCustomer.phone || "";
  const clientEmail = job.clientEmail || existingCustomer.email || "";
  const address = job.address || existingCustomer.address || "";

  return {
    ...job,

    // Keep old and new screens compatible while HQ still uses both shapes.
    clientName,
    client: job.client || clientName,
    clientPhone,
    clientEmail,
    address,

    customerDetails: {
      ...existingCustomer,
      name: existingCustomer.name || clientName,
      phone: existingCustomer.phone || clientPhone,
      email: existingCustomer.email || clientEmail,
      address: existingCustomer.address || address,
    },

    phases: Array.isArray(job.phases) ? job.phases : [],
    actualCosts: Array.isArray(job.actualCosts) ? job.actualCosts : [],

    quotes: Array.isArray(job.quotes) ? job.quotes : [],
    invoices: Array.isArray(job.invoices) ? job.invoices : [],
    payments: Array.isArray(job.payments) ? job.payments : [],
    todos: Array.isArray(job.todos) ? job.todos : [],
    archiveHistory: Array.isArray(job.archiveHistory) ? job.archiveHistory : [],

    portal: {
      enabled: false,
      token: null,
      ...(job.portal || {}),
      activity: Array.isArray(job.portal?.activity)
        ? job.portal.activity
        : [],
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

  const isPublicPage = Boolean(
    publicPortalMatch ||
    publicEstimateMatch ||
    publicInvoiceMatch ||
    publicPrintMatch,
  );

  const [authStatus, setAuthStatus] = useState("checking");
  const [currentUser, setCurrentUser] = useState(null);

  const [jobs, setJobs] = useState([]);
  const [files, setFiles] = useState([]);
  const [unsortedFiles, setUnsortedFiles] = useState([]);
  const [settingsDirty, setSettingsDirty] = useState(false);

  const [navState, setNavState] = useState({
    history: [{ screen: "WelcomeScreen", data: {} }],
    index: 0,
  });

  const activeComponent = navState.history[navState.index].screen;
  const navData = navState.history[navState.index].data;
  const openTodoCount = jobs.reduce(
    (sum, job) =>
      sum +
      (job.archived
        ? 0
        : (Array.isArray(job.todos) ? job.todos : []).filter(
            (todo) => !todo?.completed,
          ).length),
    0,
  );

  function confirmLeaveSettings() {
    if (activeComponent !== "Settings" || !settingsDirty) return true;
    return window.confirm(
      "You have unsaved Settings changes. Leave without saving them?",
    );
  }

  function navigate(screen, data = {}) {
    if (currentUser && !canAccessScreen(currentUser, screen)) {
      return;
    }
    if (screen !== "Settings" && !confirmLeaveSettings()) return;
    if (screen !== "Settings") setSettingsDirty(false);
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
    if (navState.index === 0) return;
    if (!confirmLeaveSettings()) return;
    setSettingsDirty(false);
    setNavState((prev) => {
      if (prev.index === 0) return prev;

      return {
        ...prev,
        index: prev.index - 1,
      };
    });
  }

  function goForward() {
    if (navState.index >= navState.history.length - 1) return;
    if (!confirmLeaveSettings()) return;
    setSettingsDirty(false);
    setNavState((prev) => {
      if (prev.index >= prev.history.length - 1) return prev;

      return {
        ...prev,
        index: prev.index + 1,
      };
    });
  }

  function handleUnauthorised() {
    setCurrentUser(null);
    setAuthStatus("unauthenticated");
  }

  async function authenticatedFetch(url, options = {}) {
    const response = await fetch(url, options);

    if (response.status === 401) {
      handleUnauthorised();
      throw new Error("Your login session has expired.");
    }

    return response;
  }

  async function checkAuthentication() {
    try {
      const response = await fetch(`${API_BASE}/api/auth/me`, {
        credentials: "include",
      });

      if (!response.ok) {
        handleUnauthorised();
        return;
      }

      const data = await response.json();

      setCurrentUser(data.user);
      const defaultScreen = defaultScreenForUser(data.user);
      setNavState((current) => {
        const active = current.history[current.index]?.screen;
        if (canAccessScreen(data.user, active)) return current;
        return { history: [{ screen: defaultScreen, data: {} }], index: 0 };
      });
      setAuthStatus("authenticated");
    } catch (err) {
      console.error("Could not check authentication:", err);
      handleUnauthorised();
    }
  }

  async function refreshJobs() {
    try {
      const response = await authenticatedFetch(`${API_BASE}/jobs`);

      if (!response.ok) {
        throw new Error("Could not load jobs.");
      }

      const data = await response.json();
      const normalizedJobs = data.map(normalizeJob);

      setJobs(normalizedJobs);
      localStorage.setItem("jobs", JSON.stringify(normalizedJobs));
    } catch (err) {
      console.error("Error fetching jobs:", err);
    }
  }

  async function refreshFiles() {
    try {
      const response = await authenticatedFetch(`${API_BASE}/api/files`);

      if (!response.ok) {
        throw new Error("Could not load files.");
      }

      const data = await response.json();

      setFiles(data);
    } catch (err) {
      console.error("Failed to fetch files:", err);
    }
  }

  async function refreshUnsortedFiles() {
    try {
      const response = await authenticatedFetch(
        `${API_BASE}/api/files/unsorted`,
      );

      if (!response.ok) {
        throw new Error("Could not load unsorted files.");
      }

      const data = await response.json();

      setUnsortedFiles(data);
    } catch (err) {
      console.error("Failed to fetch unsorted files:", err);
    }
  }

  useEffect(() => {
    if (isPublicPage) {
      return;
    }

    checkAuthentication();
  }, [isPublicPage]);

  useEffect(() => {
    if (isPublicPage || authStatus !== "authenticated") {
      return;
    }

    refreshJobs();
    refreshFiles();
    refreshUnsortedFiles();
  }, [authStatus, isPublicPage]);

  async function addJob(newJob) {
    try {
      const response = await authenticatedFetch(`${API_BASE}/jobs`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(normalizeJob(newJob)),
      });

      if (!response.ok) {
        let message = "Could not create job.";

        try {
          const errorData = await response.json();
          message = errorData.message || errorData.error || message;
        } catch {
          // Keep the safe fallback when the server does not return JSON.
        }

        throw new Error(message);
      }

      // The server is the source of truth for the saved job and its ID.
      const savedJob = normalizeJob(await response.json());

      setJobs((currentJobs) => {
        const updatedJobs = [...currentJobs, savedJob];
        localStorage.setItem("jobs", JSON.stringify(updatedJobs));
        return updatedJobs;
      });

      // CreateJob uses this real saved ID when opening the new Job Card.
      return savedJob;
    } catch (err) {
      console.error("Failed to create job:", err);

      // Let CreateJob display an error instead of navigating to a fake job.
      throw err;
    }
  }

  function updateJobs(updatedJobs) {
    const normalizedJobs = updatedJobs.map(normalizeJob);

    setJobs(normalizedJobs);
    localStorage.setItem("jobs", JSON.stringify(normalizedJobs));
  }

  function handleLogin(user) {
    setCurrentUser(user);
    setNavState({
      history: [{ screen: defaultScreenForUser(user), data: {} }],
      index: 0,
    });
    setAuthStatus("authenticated");
  }

  async function handleLogout() {
    if (!confirmLeaveSettings()) return;
    setSettingsDirty(false);
    try {
      await fetch(`${API_BASE}/api/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
    } catch (err) {
      console.error("Logout request failed:", err);
    } finally {
      setCurrentUser(null);
      setJobs([]);
      setFiles([]);
      setUnsortedFiles([]);
      setNavState({ history: [{ screen: "WelcomeScreen", data: {} }], index: 0 });
      setAuthStatus("unauthenticated");
    }
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

  if (publicEstimateMatch) {
    return (
      <PublicDocumentPage
        navData={{
          token: publicEstimateMatch[1],
          type: "estimate",
          id: null,
        }}
      />
    );
  }

  if (publicInvoiceMatch) {
    return (
      <PublicDocumentPage
        navData={{
          token: publicInvoiceMatch[1],
          type: "invoice",
          id: null,
        }}
      />
    );
  }

  if (publicPortalMatch) {
    return (
      <PublicPortal
        navData={{
          token: publicPortalMatch[1],
        }}
      />
    );
  }

  if (authStatus === "checking") {
    return (
      <main
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          fontFamily: "sans-serif",
        }}
      >
        <p>Loading JNR HQ...</p>
      </main>
    );
  }

  if (authStatus === "unauthenticated") {
    return <Login onLogin={handleLogin} />;
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
        currentUser={currentUser}
        onLogout={handleLogout}
        todoCount={openTodoCount}
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
          onSettingsDirtyChange={setSettingsDirty}
          currentUser={currentUser}
          onCurrentUserChange={setCurrentUser}
        />
      </MainProvider>
    </div>
  );
}

export default App;
