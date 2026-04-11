import { useState, useEffect } from "react";
import Sidebar from "./components/Sidebar";
import Main from "./components/Main";

function App() {
  const [activeComponent, setActiveComponent] = useState("NoJob");
  const [jobs, setJobs] = useState([]); // start empty
  const [activeJobId, setActiveJobId] = useState(null);

  // Fetch jobs from loft PC Node server
  useEffect(() => {
    fetch("http://192.168.0.22:3001/jobs") // Node server endpoint
      .then((res) => res.json())
      .then((data) => setJobs(data))
      .catch((err) => console.error("Error fetching jobs:", err));
  }, []);

  // Unified function to update jobs in state and localStorage (optional)
  function updateJobs(updatedJobs) {
    setJobs(updatedJobs);
    localStorage.setItem("jobs", JSON.stringify(updatedJobs)); // optional backup
  }

  function addJob(newJob) {
    const updatedJobs = [...jobs, newJob];
    updateJobs(updatedJobs);
    // TODO: POST to backend to persist
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
