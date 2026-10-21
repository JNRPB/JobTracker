import { getJobColour } from "./jobColour";

function JobBox({
  job,
  navigate,
  financials = {},
  tripStats = {},
  onUnarchive,
}) {
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

  const jobColor = getJobColour(job);

  const todos = Array.isArray(job.todos) ? job.todos : [];
  const openTodos = todos.filter((todo) => !todo?.completed);
  const actionCount = openTodos.length;
  const highImportanceCount = openTodos.filter(
    (todo) => todo.highImportance,
  ).length;
  const closeMeta = job.archiveMeta || {};
  const winningQuote =
    closeMeta.winningQuote === null || closeMeta.winningQuote === undefined
      ? null
      : Number(closeMeta.winningQuote);
  const quotedPrice = Number(closeMeta.quotedPrice ?? contractValue ?? 0);
  const quoteDifference =
    winningQuote === null ? null : quotedPrice - winningQuote;

  function shortDate(value) {
    const date = value ? new Date(value) : null;
    if (!date || Number.isNaN(date.getTime())) return "—";
    return date.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  function handleActionClick(event) {
    event.stopPropagation();
    navigate("TodoPage", { jobId: job.id });
  }

  function handleUnarchiveClick(event) {
    event.stopPropagation();
    if (!window.confirm(`Restore ${job.name || "this job"} to the live jobs list?`)) {
      return;
    }
    onUnarchive?.(job.id);
  }

  return (
    <div
      className="jobOverviewCard"
      style={{ "--job-colour": jobColor }}
      onClick={goToJob}
    >
      <div
        className="jobColourRail"
        style={{
          backgroundColor: "var(--job-colour)",
        }}
      />

      <div className="jobOverviewContent">
        <div className="jobOverviewLeft">
          <p className="jobOverviewName">{job.name || "Unnamed job"}</p>

          <p className="jobOverviewAddress">{job.address || "No address"}</p>

          <div className="jobMiniStats">
            {hasTracking ? (
              <>
                {daysVisited > 0 && (
                  <span>
                    {daysVisited} day{daysVisited === 1 ? "" : "s"}
                  </span>
                )}

                {milesAllocated > 0 && (
                  <span>{milesAllocated.toFixed(1)} mi</span>
                )}

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
              <span title={`Gross costs ${money(financials.fileCosts)}`}>
                Costs net: {money(financials.fileCostsNet ?? financials.fileCosts)}
              </span>
            )}

            {financials.pendingVatReviews > 0 && (
              <span>{financials.pendingVatReviews} VAT review</span>
            )}

            {financials.travelCost > 0 && (
              <span>Travel: {money(financials.travelCost)}</span>
            )}

            {job.archived && (
              <span className={`jobCloseTag ${closeMeta.type === "lost_quote" ? "lost" : ""}`}>
                {closeMeta.reasonLabel || closeMeta.label || "Needs classifying"}
              </span>
            )}
          </div>
        </div>

        <div className="jobOverviewRight">
          {job.archived ? (
            <>
              <div className="jobFinanceItem jobCloseOutcome">
                <span>Outcome</span>
                <strong>{closeMeta.label || "Needs classifying"}</strong>
              </div>
              <div className="jobFinanceItem">
                <span>Your quote</span>
                <strong>{quotedPrice > 0 ? money(quotedPrice) : "No quote"}</strong>
              </div>
              <div className="jobFinanceItem">
                <span>Winning quote</span>
                <strong>{winningQuote === null ? "—" : money(winningQuote)}</strong>
              </div>
              <div className="jobFinanceItem">
                <span>Quote gap</span>
                <strong className={quoteDifference > 0 ? "jobMoneyBad" : ""}>
                  {quoteDifference === null ? "—" : money(quoteDifference)}
                </strong>
              </div>
              <div className="jobFinanceItem">
                <span>Closed</span>
                <strong>{shortDate(closeMeta.archivedAt)}</strong>
              </div>
            </>
          ) : (
            <>
              <div className="jobFinanceItem">
                <span>Contract</span>
                <strong>{hasContractValue ? money(contractValue) : "No quote"}</strong>
              </div>
              <div className="jobFinanceItem">
                <span>Extras</span>
                <strong>{money(extrasValue)}</strong>
              </div>
              <div className="jobFinanceItem">
                <span>Paid</span>
                <strong>{money(paid)}</strong>
              </div>
              <div className="jobFinanceItem">
                <span>Remaining</span>
                <strong className={isPaidUp ? "jobMoneyGood" : "jobMoneyRemaining"}>
                  {money(remainingContract)}
                </strong>
              </div>
              <div className="jobFinanceItem">
                <span title="Net sales less net reclaimable costs and travel">Profit ex VAT</span>
                <strong className={isProfitGood ? "jobMoneyGood" : "jobMoneyBad"}>
                  {money(profit)}
                </strong>
              </div>
            </>
          )}

          <div className="jobActionArea">
            {job.archived ? (
              <button
                type="button"
                className="jobActionButton"
                onClick={handleUnarchiveClick}
                title="Restore archived job"
              >
                <span className="jobActionIcon">↺</span>
              </button>
            ) : (
              <button
                type="button"
                className={`jobActionButton ${
                  actionCount > 0 ? "hasActions" : ""
                } ${highImportanceCount > 0 ? "hasHighPriority" : ""}`}
                onClick={handleActionClick}
                title={
                  actionCount > 0
                    ? `${actionCount} outstanding TODO${
                        actionCount === 1 ? "" : "s"
                      }${highImportanceCount ? ` · ${highImportanceCount} high importance` : ""}`
                    : "No outstanding TODOs — click to add one"
                }
              >
                <span className="jobActionIcon">✓</span>

                {actionCount > 0 && (
                  <span className="jobActionCount">
                    {actionCount > 99 ? "99+" : actionCount}
                  </span>
                )}
              </button>
            )}

            <button
              type="button"
              className="jobMoreButton"
              onClick={(event) => {
                event.stopPropagation();
              }}
              title="More options"
            >
              ⋮
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default JobBox;
