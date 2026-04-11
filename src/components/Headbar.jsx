import { useState, useEffect } from "react";
import SideBarButton from "./SideBarButton";

function Headbar({ setActiveComponent }) {
  const [currentTime, setCurrentTime] = useState(new Date());

  // Update every second
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(interval); // cleanup
  }, []);

  return (
    <div className="headerContainer">
      <div className="stats-widget">
        {currentTime.toLocaleTimeString()} <br></br>{" "}
        {currentTime.toLocaleDateString()}
      </div>
      <p>Welcome to JNR Plastering & Building Dashboard</p>

      <div className="tabContainer">
        {" "}
        <SideBarButton
          label="Homepage"
          component="WelcomeScreen"
          setActiveComponent={setActiveComponent}
        />
        <br></br>
        <SideBarButton
          label="Jobs Overview"
          component="JobStatusOverview"
          setActiveComponent={setActiveComponent}
        />
        <br></br>
        <SideBarButton
          label="Create Job"
          component="CreateJob"
          setActiveComponent={setActiveComponent}
        />
        <br></br>
        <SideBarButton
          label="Archived Jobs"
          component="ArchivedJobs"
          setActiveComponent={setActiveComponent}
        />
      </div>
    </div>
  );
}

export default Headbar;
