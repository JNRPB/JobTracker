import SidebarButton from "./SideBarButton";

function Sidebar({ setActiveComponent, jobs, setActiveJobId }) {
  return (
    <div className="sidebar">
      <button onClick={() => setActiveComponent("Homepage")}>
        🏠 Homepage
      </button>
      {jobs
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((job) => (
          <button
            key={job.id}
            onClick={() => {
              setActiveJobId(job.id);
              setActiveComponent("JobCard");
            }}
          >
            {job.name}
          </button>
        ))}

      <SidebarButton
        label="Create Job"
        component="CreateJob"
        setActiveComponent={setActiveComponent}
      />
    </div>
  );
}

export default Sidebar;
