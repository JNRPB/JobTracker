import { useEffect, useMemo, useState } from "react";
import JobBox from "./JobBox";

const API_BASE = "";

const STATUS_ORDER = [
  "In Progress",
  "Booked",
  "Accepted",
  "Approved",
  "Quoted",
  "To-Quote",
  "Contacted",
  "Lead",
  "Completed",
];

const CLOSED_GROUPS = [
  ["lost_quote", "Lost quotes"],
  ["customer_cancelled", "Customer cancelled"],
  ["went_cold", "Went cold / no response"],
  ["not_quoted", "Did not quote"],
  ["declined_by_jnr", "Declined by JNR"],
  ["duplicate_legacy", "Duplicate / legacy"],
  ["other", "Other"],
];

function JobStatusOverview({ jobs = [], navigate, onUnarchive }) {
  const [loggedFiles, setLoggedFiles] = useState([]);
  const [tripLinks, setTripLinks] = useState([]);
  const [businessSettings, setBusinessSettings] = useState({
    defaultVatRate: 20,
    accountant: { supplierRules: [] },
  });

  const [search, setSearch] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("All");

  const [collapsedStatuses, setCollapsedStatuses] = useState(() => ({
    Completed: true,
    Contacted: true,
    Lead: true,
    Archived: true,
  }));

  useEffect(() => {
    async function fetchData() {
      try {
        const [filesRes, tripLinksRes, settingsRes] = await Promise.all([
          fetch(`${API_BASE}/api/files`),
          fetch(`${API_BASE}/api/traccar/trip-links`),
          fetch(`${API_BASE}/api/business-settings`),
        ]);

        const filesData = await filesRes.json();
        const tripLinksData = await tripLinksRes.json();
        const settingsData = await settingsRes.json();

        setLoggedFiles(Array.isArray(filesData) ? filesData : []);
        setTripLinks(Array.isArray(tripLinksData) ? tripLinksData : []);
        if (settingsRes.ok && settingsData && typeof settingsData === "object") {
          setBusinessSettings(settingsData);
        }
      } catch (err) {
        console.error("Failed to fetch overview data:", err);
      }
    }

    fetchData();
  }, []);

  function getContractValue(job) {
    const quotes = Array.isArray(job.quotes) ? job.quotes : [];

    const acceptedQuotes = quotes.filter(
      (quote) => String(quote.status || "").toLowerCase() === "accepted",
    );

    const acceptedQuoteTotal = acceptedQuotes.reduce(
      (sum, quote) => sum + Number(quote.total || 0),
      0,
    );

    return acceptedQuoteTotal || Number(job.quoteTotal || 0);
  }

  function documentNetValue(document, grossValue) {
    if (document?.subtotal !== null && document?.subtotal !== undefined) {
      const explicitSubtotal = Number(document.subtotal || 0);
      if (explicitSubtotal > 0 || Number(grossValue || 0) === 0) {
        return explicitSubtotal;
      }
    }

    const vatRate = Number(
      document?.vatRate ?? businessSettings.defaultVatRate ?? 20,
    );
    const divisor = 1 + Math.max(vatRate, 0) / 100;
    return divisor > 0 ? Number(grossValue || 0) / divisor : Number(grossValue || 0);
  }

  function getContractNetValue(job) {
    const quotes = Array.isArray(job.quotes) ? job.quotes : [];
    const acceptedQuotes = quotes.filter(
      (quote) => String(quote.status || "").toLowerCase() === "accepted",
    );

    if (acceptedQuotes.length) {
      return acceptedQuotes.reduce(
        (sum, quote) => sum + documentNetValue(quote, quote.total),
        0,
      );
    }

    const activeQuote =
      quotes.find((quote) => String(quote.id) === String(job.activeEstimateId)) ||
      quotes.find((quote) => quote.isActive) ||
      quotes.find((quote) => Number(quote.total || 0) === Number(job.quoteTotal || 0));

    return documentNetValue(activeQuote, getContractValue(job));
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

    return invoices.reduce(
      (sum, invoice) => sum + Number(invoice.total || 0),
      0,
    );
  }

  function supplierExcludedFromVat(supplier) {
    const normalise = (value) => String(value || "").trim().replace(/\s+/g, " ").toLowerCase();
    const wanted = normalise(supplier);
    return (businessSettings.accountant?.supplierRules || []).some(
      (rule) => rule.excludeFromVat === true && normalise(rule.supplier) === wanted,
    );
  }

  function getFileLinkedCosts(jobId) {
    return loggedFiles.reduce((totals, file) => {
      const links = Array.isArray(file.links) ? file.links : [];
      const fileGross = links.reduce(
        (sum, link) => sum + Number(link.cost || 0),
        0,
      );
      const vatReviewed = file.vat?.reviewed === true;
      const vatExcluded = supplierExcludedFromVat(file.supplier);
      const reclaimableVat =
        vatReviewed && !vatExcluded
          ? Math.max(Number(file.vat?.amount || 0), 0)
          : 0;

      const jobLinks = links.filter(
        (link) => link.targetType === "job" && String(link.targetId) === String(jobId),
      );
      jobLinks.forEach((link) => {
        const linkGross = Number(link.cost || 0);
        const allocatedVat = fileGross > 0
          ? reclaimableVat * (linkGross / fileGross)
          : 0;
        totals.gross += linkGross;
        totals.reclaimableVat += allocatedVat;
        totals.net += Math.max(linkGross - allocatedVat, 0);
      });
      if (!vatReviewed && !vatExcluded && jobLinks.length) {
        totals.pendingVatReviews += 1;
      }

      return totals;
    }, { gross: 0, net: 0, reclaimableVat: 0, pendingVatReviews: 0 });
  }

  function getJobTripStats(jobId) {
    const jobLinks = tripLinks.filter(
      (link) => String(link.jobId) === String(jobId),
    );

    const visitDays = new Set(
      jobLinks
        .filter((link) => link.type === "job_visit")
        .map((link) => link.date),
    );

    const milesAllocated = jobLinks.reduce(
      (sum, link) => sum + Number(link.distanceMiles || 0),
      0,
    );

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
    const contractNetValue = getContractNetValue(job);
    const invoiced = getInvoiced(job);
    const paid = getPaid(job);

    const fileCostSummary = getFileLinkedCosts(job.id);
    const fileCosts = fileCostSummary.gross;
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
      .reduce((sum, invoice) => sum + Number(invoice.total || 0), 0);

    const extrasNetValue = activeInvoices
      .filter((invoice) => invoice.isStandalone)
      .reduce(
        (sum, invoice) => sum + documentNetValue(invoice, invoice.total),
        0,
      );

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

    const profit = contractNetValue + extrasNetValue - fileCostSummary.net - travelCost;

    const outstanding = Math.max(invoiced - paid, 0);

    return {
      contractValue,
      contractNetValue,
      extrasValue,
      extrasNetValue,
      extrasPaid,
      contractPaid,
      paid,
      remainingContract,
      profit,

      invoiced,
      outstanding,

      fileCosts,
      fileCostsNet: fileCostSummary.net,
      reclaimableVat: fileCostSummary.reclaimableVat,
      pendingVatReviews: fileCostSummary.pendingVatReviews,
      travelCost,
      spent,

      quoteCount: quotes.length,

      acceptedQuoteCount: quotes.filter(
        (quote) => String(quote.status || "").toLowerCase() === "accepted",
      ).length,

      invoiceCount: invoices.length,

      paidInvoiceCount: invoices.filter(
        (invoice) => String(invoice.status || "").toLowerCase() === "paid",
      ).length,
    };
  }

  const activeJobs = useMemo(() => jobs.filter((job) => !job.archived), [jobs]);
  const archivedJobs = useMemo(() => jobs.filter((job) => job.archived), [jobs]);

  /*
    This picks up statuses we didn't explicitly define.

    So if another "Accepted"-style bug happens later,
    the job still appears.
  */
  const availableStatuses = useMemo(() => {
    const discovered = [
      ...new Set(activeJobs.map((job) => job.status).filter(Boolean)),
    ];

    const unknownStatuses = discovered.filter(
      (status) => !STATUS_ORDER.includes(status),
    );

    return [...STATUS_ORDER, ...unknownStatuses];
  }, [activeJobs]);

  const filteredJobs = useMemo(() => {
    const query = search.trim().toLowerCase();

    return activeJobs.filter((job) => {
      const matchesStatus =
        selectedStatus === "All" || job.status === selectedStatus;

      if (!matchesStatus) return false;

      if (!query) return true;

      const searchable = [
        job.name,
        job.clientName,
        job.client,
        job.address,
        job.postcode,
        job.reference,
        job.jobNumber,
        job.status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchable.includes(query);
    });
  }, [activeJobs, search, selectedStatus]);

  const filteredArchivedJobs = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (selectedStatus !== "All") return [];
    if (!query) return archivedJobs;

    return archivedJobs.filter((job) =>
      [
        job.name,
        job.clientName,
        job.client,
        job.address,
        job.postcode,
        job.reference,
        job.jobNumber,
        job.archiveMeta?.label,
        job.archiveMeta?.reasonLabel,
        job.archiveMeta?.notes,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [archivedJobs, search, selectedStatus]);

  const closedJobGroups = useMemo(() => {
    const groups = CLOSED_GROUPS.map(([type, label]) => ({
      type,
      label,
      jobs: filteredArchivedJobs.filter((job) => job.archiveMeta?.type === type),
    })).filter((group) => group.jobs.length > 0);

    const needsClassifying = filteredArchivedJobs.filter(
      (job) => !job.archiveMeta?.type,
    );
    if (needsClassifying.length) {
      groups.push({
        type: "needs_classifying",
        label: "Needs classifying",
        jobs: needsClassifying,
      });
    }

    return groups;
  }, [filteredArchivedJobs]);

  const jobsByStatus = useMemo(() => {
    const grouped = {};

    availableStatuses.forEach((status) => {
      grouped[status] = filteredJobs.filter((job) => job.status === status);
    });

    /*
      Jobs without a status don't vanish either.
    */
    const noStatus = filteredJobs.filter((job) => !job.status);

    if (noStatus.length) {
      grouped["No Status"] = noStatus;
    }

    return grouped;
  }, [filteredJobs, availableStatuses]);

  const visibleStatuses = Object.keys(jobsByStatus).filter(
    (status) => jobsByStatus[status]?.length > 0 || selectedStatus === status,
  );

  const statusCounts = useMemo(() => {
    const counts = {};

    availableStatuses.forEach((status) => {
      counts[status] = activeJobs.filter((job) => job.status === status).length;
    });

    return counts;
  }, [activeJobs, availableStatuses]);

  const totalLiveContractValue = useMemo(() => {
    return activeJobs
      .filter((job) =>
        ["In Progress", "Booked", "Accepted", "Approved"].includes(job.status),
      )
      .reduce((sum, job) => sum + getContractValue(job), 0);
  }, [activeJobs]);

  function toggleStatus(status) {
    setCollapsedStatuses((current) => ({
      ...current,
      [status]: !current[status],
    }));
  }

  function money(value) {
    return Number(value || 0).toLocaleString("en-GB", {
      style: "currency",
      currency: "GBP",
    });
  }

  const primaryFilters = [
    "All",
    "In Progress",
    "Booked",
    "Accepted",
    "Quoted",
    "To-Quote",
  ];

  return (
    <div className="jobs-page">
      <div className="jobs-page-header">
        <div>
          <h1>Jobs</h1>
          <p>Live work, completed jobs and closed outcomes in one place.</p>
        </div>

        <div className="jobs-header-actions">
          <div className="jobs-search">
            <span className="jobs-search-icon">⌕</span>

            <input
              type="text"
              placeholder="Search jobs, client, address, reference..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <button className="jobs-filter-button" type="button">
            ☰ Filters
          </button>

          <button
            className="jobs-new-button"
            type="button"
            onClick={() => navigate?.("CreateJob")}
          >
            + New Job
          </button>
        </div>
      </div>

      <div className="jobs-summary-strip">
        {primaryFilters.map((status) => {
          const count =
            status === "All" ? activeJobs.length : statusCounts[status] || 0;

          return (
            <button
              key={status}
              type="button"
              className={`jobs-summary-item ${
                selectedStatus === status ? "active" : ""
              }`}
              onClick={() => setSelectedStatus(status)}
            >
              <span>{status === "All" ? "All Jobs" : status}</span>

              <strong>{count}</strong>
            </button>
          );
        })}

        <div className="jobs-summary-value">
          <span>Live Contract Value</span>
          <strong>{money(totalLiveContractValue)}</strong>
        </div>
      </div>

      {visibleStatuses.length === 0 &&
      !(selectedStatus === "All" && filteredArchivedJobs.length > 0) ? (
        <div className="jobs-empty-state">
          <h3>No jobs found</h3>
          <p>Try changing your search or selected status.</p>
        </div>
      ) : (
        <div className="jobs-status-groups">
          {visibleStatuses.map((status) => {
            const statusJobs = jobsByStatus[status] || [];
            const isCollapsed = collapsedStatuses[status];

            const groupProfit = statusJobs.reduce((sum, job) => {
              return sum + getJobFinancials(job).profit;
            }, 0);

            return (
              <section className="jobs-status-group" key={status}>
                <button
                  type="button"
                  className="jobs-status-header"
                  onClick={() => toggleStatus(status)}
                >
                  <div className="jobs-status-title">
                    <h2>{status}</h2>

                    <span className="jobs-status-count">
                      {statusJobs.length}
                    </span>
                  </div>

                  <div className="jobs-status-right">
                    {statusJobs.length > 0 && (
                      <span
                        className={
                          groupProfit >= 0
                            ? "jobs-group-profit positive"
                            : "jobs-group-profit negative"
                        }
                      >
                        Profit ex VAT {money(groupProfit)}
                      </span>
                    )}

                    <span
                      className={`jobs-chevron ${
                        isCollapsed ? "collapsed" : ""
                      }`}
                    >
                      ⌃
                    </span>
                  </div>
                </button>

                {!isCollapsed && (
                  <div className="jobs-status-list">
                    {statusJobs.length === 0 ? (
                      <div className="jobs-status-empty">No jobs</div>
                    ) : (
                      statusJobs.map((job) => {
                        const tripStats = getJobTripStats(job.id);

                        const financials = getJobFinancials(job);

                        return (
                          <JobBox
                            key={job.id}
                            job={job}
                            navigate={navigate}
                            financials={financials}
                            tripStats={tripStats}
                            onUnarchive={onUnarchive}
                          />
                        );
                      })
                    )}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}

      {selectedStatus === "All" && archivedJobs.length > 0 && (
        <div className="jobs-status-groups jobs-archived-groups">
          <section className="jobs-status-group jobs-archived-group">
            <button
              type="button"
              className="jobs-status-header"
              onClick={() => toggleStatus("Archived")}
            >
              <div className="jobs-status-title">
                <h2>Closed jobs</h2>
                <span className="jobs-status-count">
                  {filteredArchivedJobs.length}
                </span>
              </div>

              <div className="jobs-status-right">
                <span className="jobs-archive-hint">Stored by outcome</span>
                <span
                  className={`jobs-chevron ${
                    collapsedStatuses.Archived ? "collapsed" : ""
                  }`}
                >
                  ⌃
                </span>
              </div>
            </button>

            {!collapsedStatuses.Archived && (
              <div className="jobs-status-list">
                {filteredArchivedJobs.length === 0 ? (
                  <div className="jobs-status-empty">
                    No archived jobs match your search.
                  </div>
                ) : (
                  closedJobGroups.map((group) => (
                    <section
                      className={`jobs-closed-subgroup ${
                        group.type === "needs_classifying" ? "needsClassifying" : ""
                      }`}
                      key={group.type}
                    >
                      <div className="jobs-closed-subheader">
                        <div>
                          <h3>{group.label}</h3>
                          {group.type === "needs_classifying" && (
                            <p>Older archived records — open one to classify its outcome.</p>
                          )}
                        </div>
                        <span>{group.jobs.length}</span>
                      </div>
                      <div className="jobs-closed-sublist">
                        {group.jobs.map((job) => (
                          <JobBox
                            key={job.id}
                            job={job}
                            navigate={navigate}
                            financials={getJobFinancials(job)}
                            tripStats={getJobTripStats(job.id)}
                            onUnarchive={onUnarchive}
                          />
                        ))}
                      </div>
                    </section>
                  ))
                )}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

export default JobStatusOverview;
