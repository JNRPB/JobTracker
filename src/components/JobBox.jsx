function JobBox({ job, navigate, invoices }) {
  function goToJob() {
    navigate("JobCard", { jobId: job.id });
  }

  // 🔥 allocated total (already done)
  const allocatedTotal = invoices.reduce((sum, invoice) => {
    if (!invoice.jobLinks) return sum;

    const matching = invoice.jobLinks.filter((link) => link.jobId === job.id);

    const jobTotal = matching.reduce(
      (s, link) => s + Number(link.amount || 0),
      0,
    );

    return sum + jobTotal;
  }, 0);

  const hasQuote = job.quoteTotal && job.quoteTotal > 0;

  return (
    <div className="transactionBox jobBox" onClick={goToJob}>
      <div className="transactionDateBlock">
        <p className="transactionDate">{job.status}</p>
      </div>

      <div className="transactionMiddle">
        <p className="transactionName">{job.name}</p>
        <p className="transactionJob">{job.address || "No address"}</p>
      </div>

      <div className="transactionRight">
        <p className="transactionAmount">
          {hasQuote ? `£${Number(job.quoteTotal).toFixed(0)}` : "No quote"}
        </p>
      </div>
    </div>
  );
}

export default JobBox;
