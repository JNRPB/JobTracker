function JobBox({ job, navigate, financials = {}, tripStats = {} }) {
  function goToJob() {
    navigate("JobCard", { jobId: job.id });
  }

  function money(value) {
    return `£${Number(value || 0).toFixed(2)}`;
  }

  const contractValue = Number(financials.contractValue || job.quoteTotal || 0);
  const extrasValue = Number(financials.extrasValue || 0);
  const paid = Number(financials.paid || 0);
  const remainingContract = Number(
    financials.remainingContract ?? Math.max(contractValue - paid, 0),
  );

  const profit = Number(financials.profit || 0);

  const daysVisited = Number(tripStats.daysVisited || 0);
  const milesAllocated = Number(tripStats.milesAllocated || 0);

  const hasContractValue = contractValue > 0;
  const hasTracking = daysVisited > 0 || milesAllocated > 0;
  const isPaidUp = hasContractValue && remainingContract <= 0;
  const isProfitGood = profit >= 0;

  return (
    <div className="transactionBox jobBox" onClick={goToJob}>
      <div className="transactionDateBlock">
        <p className="transactionDate">{job.status || "No status"}</p>
      </div>

      <div className="transactionMiddle">
        <p className="transactionName">{job.name || "Unnamed job"}</p>
        <p className="transactionJob">{job.address || "No address"}</p>

        <div className="jobMiniStats">
          {hasTracking ? (
            <>
              <span>{daysVisited} day(s)</span>
              <span>{milesAllocated.toFixed(1)} mi</span>

              {tripStats.lastVisitDate && (
                <span>Last: {tripStats.lastVisitDate}</span>
              )}
            </>
          ) : (
            <span>No visits logged</span>
          )}

          {financials.invoiceCount > 0 && (
            <span>
              Invoices: {financials.paidInvoiceCount || 0}/
              {financials.invoiceCount}
            </span>
          )}

          {financials.fileCosts > 0 && (
            <span>Costs: {money(financials.fileCosts)}</span>
          )}

          {financials.travelCost > 0 && (
            <span>Travel: {money(financials.travelCost)}</span>
          )}
        </div>
      </div>

      <div className="transactionRight jobBoxRight">
        <div className="jobFinanceGrid">
          <div>
            <span>Contract</span>
            <strong>
              {hasContractValue ? money(contractValue) : "No quote"}
            </strong>
          </div>

          <div>
            <span>Extras</span>
            <strong>{money(extrasValue)}</strong>
          </div>

          <div>
            <span>Paid</span>
            <strong>{money(paid)}</strong>
          </div>

          <div>
            <span>Remaining</span>
            <strong style={{ color: isPaidUp ? "#b7eb8f" : "#ffd666" }}>
              {money(remainingContract)}
            </strong>
          </div>
        </div>

        <div className="jobFinanceFooter">
          <span
            style={{
              color: isProfitGood ? "#b7eb8f" : "#ff9c9c",
            }}
          >
            Profit: {money(profit)}
          </span>
        </div>
      </div>
    </div>
  );
}

export default JobBox;

