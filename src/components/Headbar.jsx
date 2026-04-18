import { useState, useEffect } from "react";
import SideBarButton from "./SideBarButton";

function Headbar({ navigate }) {
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
          navigate={navigate}
        />
        <SideBarButton
          label="Jobs Overview"
          component="JobStatusOverview"
          navigate={navigate}
        />
        <SideBarButton
          label="Create Job"
          component="CreateJob"
          navigate={navigate}
        />
        <SideBarButton
          label="Archived Jobs"
          component="ArchivedJobs"
          navigate={navigate}
        />
        <SideBarButton
          label="Invoices"
          component="Invoices"
          navigate={navigate}
        />
      </div>
    </div>
  );
}

export default Headbar;
