import { useState, useEffect } from "react";

function WelcomeScreen({ jobs = [] }) {
  const [storage, setStorage] = useState(null);

  useEffect(() => {
    fetch("http://192.168.0.22:3001/api/storage")
      .then((res) => res.json())
      .then((data) => setStorage(data))
      .catch((err) => console.error("Failed to fetch storage:", err));
  }, []);

  const statuses = [
    "Lead",
    "Contacted",
    "To-Quote",
    "Quoted",
    "Approved",
    "Booked",
    "In Progress",
  ];

  const activeJobs = jobs.filter(
    (job) => !job.archived && job.status !== "Completed",
  );

  const jobsByStatus = {};
  statuses.forEach((status) => {
    jobsByStatus[status] = activeJobs.filter(
      (job) => job.status === status,
    ).length;
  });

  const bentonsJobsCount = activeJobs.filter((job) =>
    job.name?.trim().toUpperCase().startsWith("BNT"),
  ).length;

  const approvedOrHigherStatuses = ["Approved", "Booked", "In Progress"];

  const approvedOrHigherValue = activeJobs
    .filter((job) => approvedOrHigherStatuses.includes(job.status))
    .reduce((sum, job) => sum + Number(job.quoteTotal || 0), 0);

  const highestValueJob = activeJobs.reduce((highest, job) => {
    const value = Number(job.quoteTotal || 0);

    if (!highest || value > Number(highest.quoteTotal || 0)) {
      return job;
    }

    return highest;
  }, null);

  const jobsByMonth = activeJobs.reduce((acc, job) => {
    if (!job.startDate) return acc;

    const date = new Date(job.startDate);
    if (isNaN(date.getTime())) return acc;

    const monthKey = `${date.getFullYear()}-${date.getMonth()}`;

    if (!acc[monthKey]) {
      acc[monthKey] = {
        label: date.toLocaleString("en-GB", {
          month: "long",
          year: "numeric",
        }),
        count: 0,
        totalValue: 0,
        jobs: [],
      };
    }

    acc[monthKey].count += 1;
    acc[monthKey].totalValue += Number(job.quoteTotal || 0);
    acc[monthKey].jobs.push(job);

    return acc;
  }, {});

  const sortedJobMonths = Object.entries(jobsByMonth).sort((a, b) => {
    const [yearA, monthA] = a[0].split("-").map(Number);
    const [yearB, monthB] = b[0].split("-").map(Number);

    return yearA - yearB || monthA - monthB;
  });

  return (
    <div className="widget">
      <h3>📦 Storage</h3>

      {storage ? (
        <>
          <p>Used: {storage.used} GB</p>
          <p>Free: {storage.free} GB</p>
          <p>Total: {storage.total} GB</p>
        </>
      ) : (
        <p>Loading storage...</p>
      )}

      <hr />

      <h3>📋 Job Status Counts</h3>
      {statuses.map((status) => (
        <p key={status}>
          {status}: {jobsByStatus[status]}
        </p>
      ))}

      <hr />

      <h3>📅 Jobs by Month</h3>
      {sortedJobMonths.length > 0 ? (
        sortedJobMonths.map(([key, month]) => (
          <div key={key} style={{ marginBottom: "0.8rem" }}>
            <p style={{ margin: 0 }}>
              <strong>{month.label}</strong>
            </p>
            <p style={{ margin: 0 }}>Jobs: {month.count}</p>
            <p style={{ margin: 0 }}>Value: £{month.totalValue.toFixed(2)}</p>
          </div>
        ))
      ) : (
        <p>No dated jobs</p>
      )}

      <hr />

      <h3>🏠 Bentons Jobs</h3>
      <p>{bentonsJobsCount}</p>

      <hr />

      <h3>💷 Approved or Higher Value</h3>
      <p>£{approvedOrHigherValue.toFixed(2)}</p>

      <hr />

      <h3>🏆 Highest Value Job</h3>
      {highestValueJob ? (
        <>
          <p>{highestValueJob.name}</p>
          <p>£{Number(highestValueJob.quoteTotal || 0).toFixed(2)}</p>
        </>
      ) : (
        <p>No jobs</p>
      )}
    </div>
  );
}

export default WelcomeScreen;
