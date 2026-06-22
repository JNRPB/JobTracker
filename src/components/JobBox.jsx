function JobBox({
  job,
  navigate,
  invoices,
  margin,
  fileLinkedCost,
  tripStats,
}) {
  function goToJob() {
    navigate("JobCard", { jobId: job.id });
  }

  const hasQuote = Number(job.quoteTotal || 0) > 0;
  const hasTracking =
    tripStats &&
    (Number(tripStats.daysVisited || 0) > 0 ||
      Number(tripStats.milesAllocated || 0) > 0);

  return (
    <div className="transactionBox jobBox" onClick={goToJob}>
      <div className="transactionDateBlock">
        <p className="transactionDate">{job.status}</p>
      </div>

      <div className="transactionMiddle">
        <p className="transactionName">{job.name}</p>
        <p className="transactionJob">{job.address || "No address"}</p>

        <div className="jobMiniStats">
          {hasTracking ? (
            <>
              <span>{Number(tripStats.daysVisited || 0)} day(s)</span>
              <span>{Number(tripStats.milesAllocated || 0).toFixed(1)} mi</span>

              {tripStats.lastVisitDate && (
                <span>Last: {tripStats.lastVisitDate}</span>
              )}
            </>
          ) : (
            <span>No visits logged</span>
          )}

          {fileLinkedCost > 0 && (
            <span>Costs: £{Number(fileLinkedCost || 0).toFixed(0)}</span>
          )}
        </div>
      </div>

      <div className="transactionRight jobBoxRight">
        <p className="transactionAmount">
          {hasQuote ? `£${Number(job.quoteTotal).toFixed(2)}` : "No quote"}
        </p>

        {hasQuote && (
          <p
            className="jobMargin"
            style={{
              color: margin >= 0 ? "#b7eb8f" : "#ff9c9c",
              fontSize: "0.85rem",
              marginTop: "0.2rem",
            }}
          >
            £{Number(margin || 0).toFixed(2)}
          </p>
        )}
      </div>
    </div>
  );
}

export default JobBox;
