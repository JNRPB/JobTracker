import { useEffect, useState } from "react";
import JobBox from "./JobBox";

const API_BASE = "";

function JobStatusOverview({ jobs = [], navigate }) {
  const [showBentonsJobs, setShowBentonsJobs] = useState(false);
  const [loggedFiles, setLoggedFiles] = useState([]);
  const [tripLinks, setTripLinks] = useState([]);

  useEffect(() => {
    async function fetchData() {
      try {
        const [filesRes, tripLinksRes] = await Promise.all([
          fetch(`${API_BASE}/api/files`),
          fetch(`${API_BASE}/api/traccar/trip-links`),
        ]);

        const filesData = await filesRes.json();
        const tripLinksData = await tripLinksRes.json();

        setLoggedFiles(Array.isArray(filesData) ? filesData : []);
        setTripLinks(Array.isArray(tripLinksData) ? tripLinksData : []);
      } catch (err) {
        console.error("Failed to fetch overview data:", err);
      }
    }

    fetchData();
  }, []);

  const statuses = [
    "In Progress",
    "Booked",
    "Approved",
    "Quoted",
    "To-Quote",
    "Contacted",
    "Lead",
    "Completed",
  ];

  const activeJobs = jobs.filter((job) => !job.archived);

  const visibleJobs = activeJobs.filter((job) => {
    if (showBentonsJobs) return true;

    return !job.name?.trim().toUpperCase().startsWith("BNT");
  });

  function getContractValue(job) {
    const quotes = Array.isArray(job.quotes) ? job.quotes : [];

    const acceptedQuotes = quotes.filter((quote) => {
      return String(quote.status || "").toLowerCase() === "accepted";
    });

    const acceptedQuoteTotal = acceptedQuotes.reduce((sum, quote) => {
      return sum + Number(quote.total || 0);
    }, 0);

    return acceptedQuoteTotal || Number(job.quoteTotal || 0);
  }

  function getPaid(job) {
    const invoices = Array.isArray(job.invoices) ? job.invoices : [];

    return invoices.reduce((sum, invoice) => {
      const status = String(invoice.status || "").toLowerCase();

      if (status === "paid") {
        return sum + Number(invoice.paidAmount || invoice.total || 0);
      }

      return sum + Number(invoice.paidAmount || 0);
    }, 0);
  }

  function getInvoiced(job) {
    const invoices = Array.isArray(job.invoices) ? job.invoices : [];

    return invoices.reduce((sum, invoice) => {
      return sum + Number(invoice.total || 0);
    }, 0);
  }

  function getFileLinkedCost(jobId) {
    return loggedFiles.reduce((sum, file) => {
      const links = Array.isArray(file.links) ? file.links : [];

      const costFromLinks = links.reduce((linkSum, link) => {
        const isLinkedToJob =
          link.targetType === "job" && String(link.targetId) === String(jobId);

        if (!isLinkedToJob) return linkSum;

        return linkSum + Number(link.cost || 0);
      }, 0);

      return sum + costFromLinks;
    }, 0);
  }

  function getJobTripStats(jobId) {
    const jobLinks = tripLinks.filter((link) => {
      return String(link.jobId) === String(jobId);
    });

    const visitDays = new Set(
      jobLinks
        .filter((link) => link.type === "job_visit")
        .map((link) => link.date),
    );

    const milesAllocated = jobLinks.reduce((sum, link) => {
      return sum + Number(link.distanceMiles || 0);
    }, 0);

    const travelCost = milesAllocated * 0.45;

    return {
      daysVisited: visitDays.size,
      milesAllocated,
      travelCost,
    };
  }

  function getJobFinancials(job) {
    const quotes = Array.isArray(job.quotes) ? job.quotes : [];
    const invoices = Array.isArray(job.invoices) ? job.invoices : [];

    const contractValue = getContractValue(job);
    const invoiced = getInvoiced(job);
    const paid = getPaid(job);

    const fileCosts = getFileLinkedCost(job.id);
    const tripStats = getJobTripStats(job.id);

    const travelCost = Number(tripStats.travelCost || 0);
    const spent = fileCosts + travelCost;

    const activeInvoices = invoices.filter((invoice) =>
      ["issued", "emailed", "paid"].includes(
        String(invoice.status || "").toLowerCase(),
      ),
    );

    const extrasValue = activeInvoices
      .filter((invoice) => invoice.isStandalone)
      .reduce((sum, invoice) => {
        return sum + Number(invoice.total || 0);
      }, 0);

    const extrasPaid = activeInvoices
      .filter((invoice) => invoice.isStandalone)
      .reduce((sum, invoice) => {
        const status = String(invoice.status || "").toLowerCase();

        if (status === "paid") {
          return sum + Number(invoice.paidAmount || invoice.total || 0);
        }

        return sum + Number(invoice.paidAmount || 0);
      }, 0);

    const contractPaid = Math.max(paid - extrasPaid, 0);

    const remainingContract = Math.max(contractValue - contractPaid, 0);

    const profit = contractValue + extrasValue - spent;

    const outstanding = Math.max(invoiced - paid, 0);

    const acceptedQuoteCount = quotes.filter((quote) => {
      return String(quote.status || "").toLowerCase() === "accepted";
    }).length;

    const paidInvoiceCount = invoices.filter((invoice) => {
      return String(invoice.status || "").toLowerCase() === "paid";
    }).length;

    return {
      contractValue,
      extrasValue,
      extrasPaid,
      contractPaid,
      paid,
      remainingContract,
      profit,

      invoiced,
      outstanding,

      fileCosts,
      travelCost,
      spent,

      quoteCount: quotes.length,
      acceptedQuoteCount,
      invoiceCount: invoices.length,
      paidInvoiceCount,
    };
  }

  const jobsByStatus = {};

  statuses.forEach((status) => {
    jobsByStatus[status] = visibleJobs.filter((job) => job.status === status);
  });

  return (
    <div className="overview-container">
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          marginBottom: "1rem",
        }}
      >
        <input
          type="checkbox"
          id="showBentonsJobs"
          checked={showBentonsJobs}
          onChange={(e) => setShowBentonsJobs(e.target.checked)}
        />

        <label htmlFor="showBentonsJobs">View Bentons jobs?</label>
      </div>

      {statuses.map((status) => (
        <div className="status-group" key={status}>
          <div className="status-header">
            <h2>{status}</h2>
            <span>{jobsByStatus[status].length}</span>
          </div>

          <div className="status-list">
            {jobsByStatus[status].map((job) => {
              const tripStats = getJobTripStats(job.id);
              const financials = getJobFinancials(job);

              return (
                <JobBox
                  key={job.id}
                  job={job}
                  navigate={navigate}
                  financials={financials}
                  tripStats={tripStats}
                />
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

export default JobStatusOverview;

