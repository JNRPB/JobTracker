import { useState, useEffect } from "react";

import Headbar from "./components/Headbar";
import Main from "./components/Main";

function App() {
  const [activeComponent, setActiveComponent] = useState("WelcomeScreen");
  const [jobs, setJobs] = useState([]); // start empty
  const [activeJobId, setActiveJobId] = useState(null);

  // Navigation Function

  function navigate(screen, jobId = null) {
    setActiveComponent(screen);
    setActiveJobId(jobId);
  }

  // Fetch jobs from loft PC Node server
  useEffect(() => {
    fetch("http://192.168.0.22:3001/jobs") // Node server endpoint
      .then((res) => res.json())
      .then((data) => setJobs(data))
      .catch((err) => console.error("Error fetching jobs:", err));
  }, []);

  // Add Job to Server
  async function addJob(newJob) {
    try {
      const res = await fetch("http://192.168.0.22:3001/jobs", {
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

  // Unified function to update jobs in state and localStorage (optional)
  function updateJobs(updatedJobs) {
    setJobs(updatedJobs);
    localStorage.setItem("jobs", JSON.stringify(updatedJobs)); // optional backup
  }

  return (
    <div className="app-container">
      <Headbar navigate={navigate} />
      <Main
        activeComponent={activeComponent}
        addJob={addJob}
        jobs={jobs}
        activeJobId={activeJobId}
        setJobs={updateJobs}
        navigate={navigate}
      />

      <h1>
        Active Component is : {activeComponent} and Active Job ID is:{" "}
        {activeJobId}
      </h1>
    </div>
  );
}

export default App;
