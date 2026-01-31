import { useState } from "react";
import Sidebar from "./components/Sidebar";
import Main from "./components/Main";

function App() {
  const [activeComponent, setActiveComponent] = useState("NoJob");

  // Load jobs from localStorage on initial render
  const [jobs, setJobs] = useState(() => {
    return JSON.parse(localStorage.getItem("jobs") || "[]");
  });

  const [activeJobId, setActiveJobId] = useState(null);

  // Unified function to update jobs and persist in localStorage
  function updateJobs(updatedJobs) {
    setJobs(updatedJobs);
    localStorage.setItem("jobs", JSON.stringify(updatedJobs));
  }

  // Add a new job
  function addJob(newJob) {
    const updatedJobs = [...jobs, newJob];
    updateJobs(updatedJobs);
  }

  return (
    <div className="app-container">
      <Sidebar
        setActiveComponent={setActiveComponent}
        jobs={jobs}
        setActiveJobId={setActiveJobId}
      />
      <Main
        activeComponent={activeComponent}
        addJob={addJob}
        jobs={jobs}
        activeJobId={activeJobId}
        setJobs={updateJobs}
        setActiveComponent={setActiveComponent}
        setActiveJobId={setActiveJobId}
      />
    </div>
  );
}

export default App;
