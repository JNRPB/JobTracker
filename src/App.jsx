import { useState } from "react";
import Sidebar from "./components/Sidebar";
import Main from "./components/Main";

function App() {
  const [activeComponent, setActiveComponent] = useState("NoJob");
  const [jobs, setJobs] = useState([]);
  const [activeJobId, setActiveJobId] = useState(null);

  console.log("Job:", jobs);
  function addJob(newJob) {
    setJobs((prevJobs) => [...prevJobs, newJob]);
  }

  return (
    <>
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
          setJobs={setJobs}
        />
      </div>
    </>
  );
}

export default App;
