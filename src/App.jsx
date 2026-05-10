import { useState, useEffect } from "react";

import Headbar from "./components/Headbar";
import Main from "./components/Main";
import { MainProvider } from "./components/Provider";

function App() {
  const API_BASE = "http://100.68.229.104:3001";

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

      setJobs(data);
      localStorage.setItem("jobs", JSON.stringify(data));
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
        body: JSON.stringify(newJob),
      });

      const savedJob = await res.json();

      const updatedJobs = [...jobs, savedJob];
      setJobs(updatedJobs);
      localStorage.setItem("jobs", JSON.stringify(updatedJobs));
    } catch (err) {
      console.error("Failed to create job:", err);
    }
  }

  function updateJobs(updatedJobs) {
    setJobs(updatedJobs);
    localStorage.setItem("jobs", JSON.stringify(updatedJobs));
  }

  return (
    <div className="app-container">
      <Headbar navigate={navigate} activeComponent={activeComponent} />

      <div className="bottomNav">
        <button onClick={goBack} disabled={navState.index === 0}>
          ◀ Back
        </button>

        <button
          onClick={goForward}
          disabled={navState.index >= navState.history.length - 1}
        >
          Forward ▶
        </button>
      </div>

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
