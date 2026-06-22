import { useEffect, useState } from "react";
import SideBarButton from "./SideBarButton";

const API_BASE = "http://192.168.0.22:3001";

const VAT_EXCLUDED_DEFAULTS = [
  "Callum Mullineaux",
  "Max Magee",
  "Perfect Plastering by DS",
];

const businessTargets = [
  { id: "ppe", name: "PPE / Workwear" },
  { id: "fuel", name: "Fuel" },
  { id: "tools", name: "Tools" },
  { id: "van", name: "Van / Repairs" },
  { id: "stock", name: "Stock / Materials Held" },
  { id: "office", name: "Office / Admin" },
  { id: "insurance", name: "Insurance" },
  { id: "accounting", name: "Accounting" },
  { id: "general", name: "General Business Expense" },
];

const statuses = [
  "Lead",
  "Contacted",
  "To-Quote",
  "Quoted",
  "Approved",
  "Booked",
  "In Progress",
];

function WelcomeScreen({ jobs = [], unsortedFiles = [], navigate }) {
  const [loggedFiles, setLoggedFiles] = useState([]);
  const [datePreset, setDatePreset] = useState("all");
  const [vatExcludedSuppliers, setVatExcludedSuppliers] = useState(() => {
    const saved = localStorage.getItem("vatExcludedSuppliers");
    return saved ? JSON.parse(saved) : VAT_EXCLUDED_DEFAULTS;
  });
  const [newExcludedSupplier, setNewExcludedSupplier] = useState("");

  useEffect(() => {
    fetchLoggedFiles();
  }, []);

  useEffect(() => {
    localStorage.setItem(
      "vatExcludedSuppliers",
      JSON.stringify(vatExcludedSuppliers),
    );
  }, [vatExcludedSuppliers]);

  async function fetchLoggedFiles() {
    try {
      const res = await fetch(`${API_BASE}/api/files`);
      const data = await res.json();
      setLoggedFiles(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to fetch logged files:", err);
    }
  }

  function getDateRange() {
    const now = new Date();
    const start = new Date(now);
    const end = new Date(now);

    if (datePreset === "all") {
      return { start: null, end: null, label: "All time" };
    }

    if (datePreset === "thisMonth") {
      start.setDate(1);
      start.setHours(0, 0, 0, 0);

      end.setMonth(end.getMonth() + 1);
      end.setDate(0);
      end.setHours(23, 59, 59, 999);

      return {
        start,
        end,
        label: start.toLocaleDateString("en-GB", {
          month: "long",
          year: "numeric",
        }),
      };
    }

    if (datePreset === "lastMonth") {
      start.setMonth(start.getMonth() - 1);
      start.setDate(1);
      start.setHours(0, 0, 0, 0);

      end.setDate(1);
      end.setHours(0, 0, 0, 0);
      end.setMilliseconds(-1);

      return {
        start,
        end,
        label: start.toLocaleDateString("en-GB", {
          month: "long",
          year: "numeric",
        }),
      };
    }

    if (datePreset === "thisYear") {
      start.setMonth(0, 1);
      start.setHours(0, 0, 0, 0);

      end.setMonth(11, 31);
      end.setHours(23, 59, 59, 999);

      return {
        start,
        end,
        label: String(now.getFullYear()),
      };
    }

    return { start: null, end: null, label: "All time" };
  }

  const dateRange = getDateRange();

  function dateIsInRange(dateString) {
    if (!dateRange.start || !dateRange.end) return true;
    if (!dateString) return false;

    const date = new Date(dateString);
    if (isNaN(date.getTime())) return false;

    return date >= dateRange.start && date <= dateRange.end;
  }

  function getFileName(file) {
    return file.fileName || file.name || "Unnamed file";
  }

  function getFileDate(file) {
    return file.purchaseDate || file.dateSorted || file.uploadedAt || "";
  }

  function getFileUrl(file) {
    if (!file.url) return "";
    return `${API_BASE}${file.url}`;
  }

  function getFileTotal(file) {
    const links = Array.isArray(file.links) ? file.links : [];
    return links.reduce((sum, link) => sum + Number(link.cost || 0), 0);
  }

  function getVatFromGross(gross) {
    return Number(gross || 0) / 6;
  }

  function supplierIsVatExcluded(supplier) {
    const cleanSupplier = (supplier || "").trim().toLowerCase();

    return vatExcludedSuppliers.some(
      (excluded) => excluded.trim().toLowerCase() === cleanSupplier,
    );
  }

  function getBusinessName(id) {
    const target = businessTargets.find((item) => item.id === id);
    return target?.name || id || "Business";
  }

  function isWasteDisposal(file, link = {}) {
    const searchableText = [
      getFileName(file),
      file.description,
      file.notes,
      file.supplier,
      link.description,
      link.notes,
      link.category,
      link.targetName,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return searchableText.includes("waste") || searchableText.includes("skip");
  }

  function addExcludedSupplier() {
    const clean = newExcludedSupplier.trim();
    if (!clean) return;

    const alreadyExists = vatExcludedSuppliers.some(
      (supplier) => supplier.toLowerCase() === clean.toLowerCase(),
    );

    if (!alreadyExists) {
      setVatExcludedSuppliers((prev) => [...prev, clean]);
    }

    setNewExcludedSupplier("");
  }

  function removeExcludedSupplier(name) {
    setVatExcludedSuppliers((prev) =>
      prev.filter((supplier) => supplier !== name),
    );
  }

  const activeJobs = jobs.filter(
    (job) => !job.archived && job.status !== "Completed",
  );

  const periodFiles = loggedFiles.filter((file) =>
    dateIsInRange(getFileDate(file)),
  );

  const periodJobs = activeJobs.filter((job) => {
    if (datePreset === "all") return true;
    return dateIsInRange(job.startDate);
  });

  const pipelineValue = periodJobs.reduce(
    (sum, job) => sum + Number(job.quoteTotal || 0),
    0,
  );

  const confirmedStatuses = ["Approved", "Booked", "In Progress"];

  const confirmedValue = periodJobs
    .filter((job) => confirmedStatuses.includes(job.status))
    .reduce((sum, job) => sum + Number(job.quoteTotal || 0), 0);

  const periodSpend = periodFiles.reduce(
    (sum, file) => sum + getFileTotal(file),
    0,
  );

  const vatEligibleSpend = periodFiles.reduce((sum, file) => {
    if (supplierIsVatExcluded(file.supplier)) return sum;
    return sum + getFileTotal(file);
  }, 0);

  const vatEstimate = getVatFromGross(vatEligibleSpend);

  const fuelSpend = periodFiles.reduce((sum, file) => {
    const links = Array.isArray(file.links) ? file.links : [];

    return (
      sum +
      links
        .filter(
          (link) => link.targetType === "business" && link.targetId === "fuel",
        )
        .reduce((linkSum, link) => linkSum + Number(link.cost || 0), 0)
    );
  }, 0);

  const wasteDisposalSpend = periodFiles.reduce((sum, file) => {
    const links = Array.isArray(file.links) ? file.links : [];

    return (
      sum +
      links
        .filter((link) => isWasteDisposal(file, link))
        .reduce((linkSum, link) => linkSum + Number(link.cost || 0), 0)
    );
  }, 0);

  const jobsByStatus = statuses.map((status) => ({
    status,
    count: activeJobs.filter((job) => job.status === status).length,
  }));

  const highestValueJob = activeJobs.reduce((highest, job) => {
    const value = Number(job.quoteTotal || 0);
    if (!highest || value > Number(highest.quoteTotal || 0)) return job;
    return highest;
  }, null);

  const singleSpendLinks = periodFiles.flatMap((file) => {
    const links = Array.isArray(file.links) ? file.links : [];

    return links
      .filter((link) => Number(link.cost || 0) > 0)
      .map((link) => ({
        fileName: getFileName(file),
        supplier: file.supplier || "No supplier",
        cost: Number(link.cost || 0),
        target:
          link.targetType === "job"
            ? link.targetName || `Job ${link.targetId}`
            : getBusinessName(link.targetId),
        category: isWasteDisposal(file, link)
          ? "Waste Disposal"
          : link.category || "uncategorised",
      }));
  });

  const biggestSingleSpend = singleSpendLinks.reduce((biggest, item) => {
    if (!biggest || item.cost > biggest.cost) return item;
    return biggest;
  }, null);

  const smallestSingleSpend = singleSpendLinks.reduce((smallest, item) => {
    if (!smallest || item.cost < smallest.cost) return item;
    return smallest;
  }, null);

  const missingCostCount = loggedFiles.filter((file) => {
    const links = Array.isArray(file.links) ? file.links : [];
    return links.some((link) => link.cost === null || link.cost === undefined);
  }).length;

  const missingSupplierCount = loggedFiles.filter(
    (file) => !file.supplier?.trim(),
  ).length;

  const missingDateCount = loggedFiles.filter(
    (file) => !getFileDate(file),
  ).length;

  const jobsWithoutStartDate = activeJobs.filter(
    (job) => !job.startDate,
  ).length;

  const needsAttention =
    unsortedFiles.length +
    missingCostCount +
    missingSupplierCount +
    missingDateCount +
    jobsWithoutStartDate;

  const businessSpendBreakdown = businessTargets
    .map((target) => {
      const total = periodFiles.reduce((sum, file) => {
        const links = Array.isArray(file.links) ? file.links : [];

        return (
          sum +
          links
            .filter(
              (link) =>
                link.targetType === "business" && link.targetId === target.id,
            )
            .reduce((linkSum, link) => linkSum + Number(link.cost || 0), 0)
        );
      }, 0);

      return { ...target, total };
    })
    .filter((item) => item.total > 0);

  const spendBreakdown = [
    ...businessSpendBreakdown,
    {
      id: "waste-disposal",
      name: "Waste Disposal",
      total: wasteDisposalSpend,
    },
  ]
    .filter((item) => item.total > 0)
    .sort((a, b) => b.total - a.total);

  const recentFiles = [...periodFiles]
    .sort((a, b) => new Date(getFileDate(b)) - new Date(getFileDate(a)))
    .slice(0, 5);

  return (
    <div className="widget files-dashboard">
      <div className="files-header">
        <div>
          <h2>Business Command Centre</h2>
          <p className="soft-text">
            Showing: <strong>{dateRange.label}</strong>
          </p>
        </div>

        <div className="command-actions">
          <select
            className="dashboard-select"
            value={datePreset}
            onChange={(e) => setDatePreset(e.target.value)}
          >
            <option value="all">All time</option>
            <option value="thisMonth">This month</option>
            <option value="lastMonth">Last month</option>
            <option value="thisYear">This year</option>
          </select>

          <SideBarButton
            label="View Files"
            component="Files"
            navigate={navigate}
          />
          <SideBarButton
            label="Sort Files"
            component="UnsortedFiles"
            navigate={navigate}
          />
        </div>
      </div>

      <div className="dashboard-shortcut-row">
        <button
          className="sleekButton primaryButton"
          onClick={() =>
            navigate("Files", {
              businessTargetId: "certificates-licences",
            })
          }
        >
          Certificates & Licences
        </button>
      </div>

      <div className="files-stat-grid">
        <div className="file-stat-card">
          <h3>Active Jobs</h3>
          <p>{activeJobs.length}</p>
        </div>

        <div className="file-stat-card">
          <h3>Pipeline Value</h3>
          <p>£{pipelineValue.toFixed(2)}</p>
        </div>

        <div className="file-stat-card">
          <h3>Confirmed Work</h3>
          <p>£{confirmedValue.toFixed(2)}</p>
        </div>

        <div className="file-stat-card">
          <h3>Period Spend</h3>
          <p>£{periodSpend.toFixed(2)}</p>
        </div>

        <div className="file-stat-card">
          <h3>VAT Estimate</h3>
          <p>£{vatEstimate.toFixed(2)}</p>
        </div>

        <div className="file-stat-card">
          <h3>Fuel Spend</h3>
          <p>£{fuelSpend.toFixed(2)}</p>
        </div>

        <div className="file-stat-card">
          <h3>Waste Disposal</h3>
          <p>£{wasteDisposalSpend.toFixed(2)}</p>
        </div>

        <div className="file-stat-card">
          <h3>Unsorted Files</h3>
          <p>{unsortedFiles.length}</p>
        </div>
      </div>

      <div className="files-warning-grid">
        {unsortedFiles.length > 0 && (
          <div className="invoiceWarning warning-row">
            <span>
              📥 {unsortedFiles.length} unsorted file
              {unsortedFiles.length !== 1 ? "s" : ""} waiting
            </span>
            <button
              className="warning-fix-button"
              onClick={() => navigate("UnsortedFiles")}
            >
              Fix
            </button>
          </div>
        )}

        {missingCostCount > 0 && (
          <div className="invoiceWarning warning-row">
            <span>
              ⚠️ {missingCostCount} file{missingCostCount !== 1 ? "s" : ""} with
              missing cost
            </span>
            <button
              className="warning-fix-button"
              onClick={() => navigate("Files")}
            >
              Fix
            </button>
          </div>
        )}

        {missingSupplierCount > 0 && (
          <div className="invoiceWarning warning-row">
            <span>
              ⚠️ {missingSupplierCount} file
              {missingSupplierCount !== 1 ? "s" : ""} with missing supplier
            </span>
            <button
              className="warning-fix-button"
              onClick={() => navigate("Files")}
            >
              Fix
            </button>
          </div>
        )}

        {missingDateCount > 0 && (
          <div className="invoiceWarning warning-row">
            <span>
              ⚠️ {missingDateCount} file{missingDateCount !== 1 ? "s" : ""} with
              missing date
            </span>
            <button
              className="warning-fix-button"
              onClick={() => navigate("Files")}
            >
              Fix
            </button>
          </div>
        )}

        {jobsWithoutStartDate > 0 && (
          <div className="invoiceWarning warning-row">
            <span>
              ⚠️ {jobsWithoutStartDate} active job
              {jobsWithoutStartDate !== 1 ? "s" : ""} without a start date
            </span>
            <button
              className="warning-fix-button"
              onClick={() => navigate("JobStatusOverview")}
            >
              Fix
            </button>
          </div>
        )}
      </div>

      <div className="files-breakdown-grid feature-grid">
        <div className="files-breakdown-panel">
          <h3>🏆 Highest Value Job</h3>
          {highestValueJob ? (
            <>
              <p className="feature-title">{highestValueJob.name}</p>
              <strong>
                £{Number(highestValueJob.quoteTotal || 0).toFixed(2)}
              </strong>
            </>
          ) : (
            <p className="soft-text">No active jobs yet.</p>
          )}
        </div>

        <div className="files-breakdown-panel">
          <h3>📂 Files Logged</h3>
          <p className="feature-title">{periodFiles.length} files</p>
          <p className="soft-text">
            {loggedFiles.length} total files in system
          </p>
          <strong>{unsortedFiles.length} unsorted</strong>
        </div>

        <div className="files-breakdown-panel">
          <h3>💣 Biggest Single Spend</h3>
          {biggestSingleSpend ? (
            <>
              <p className="feature-title">{biggestSingleSpend.supplier}</p>
              <p className="soft-text">
                {biggestSingleSpend.target} · {biggestSingleSpend.category}
              </p>
              <strong>£{biggestSingleSpend.cost.toFixed(2)}</strong>
            </>
          ) : (
            <p className="soft-text">No spend logged.</p>
          )}
        </div>

        <div className="files-breakdown-panel">
          <h3>🐜 Smallest Single Spend</h3>
          {smallestSingleSpend ? (
            <>
              <p className="feature-title">{smallestSingleSpend.supplier}</p>
              <p className="soft-text">
                {smallestSingleSpend.target} · {smallestSingleSpend.category}
              </p>
              <strong>£{smallestSingleSpend.cost.toFixed(2)}</strong>
            </>
          ) : (
            <p className="soft-text">No spend logged.</p>
          )}
        </div>
      </div>

      <div className="dashboard-two-column">
        <div className="files-breakdown-panel">
          <h3>Job Status</h3>
          <div className="files-breakdown-grid">
            {jobsByStatus.map((item) => (
              <div className="files-breakdown-card" key={item.status}>
                <span>{item.status}</span>
                <strong>{item.count}</strong>
              </div>
            ))}
          </div>
        </div>

        <div className="files-breakdown-panel">
          <h3>Spend Breakdown</h3>
          {spendBreakdown.length === 0 ? (
            <p className="soft-text">No spend in this period.</p>
          ) : (
            <div className="files-breakdown-grid">
              {spendBreakdown.map((item) => (
                <div className="files-breakdown-card" key={item.id}>
                  <span>{item.name}</span>
                  <strong>£{item.total.toFixed(2)}</strong>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="dashboard-two-column">
        <div className="files-breakdown-panel">
          <h3>VAT Excluded Suppliers</h3>
          <p className="soft-text">
            These suppliers are ignored when estimating VAT reclaim.
          </p>

          <div className="excluded-supplier-list">
            {vatExcludedSuppliers.map((supplier) => (
              <div className="excluded-supplier-pill" key={supplier}>
                <span>{supplier}</span>
                <button onClick={() => removeExcludedSupplier(supplier)}>
                  ×
                </button>
              </div>
            ))}
          </div>

          <div className="excluded-supplier-input">
            <input
              value={newExcludedSupplier}
              onChange={(e) => setNewExcludedSupplier(e.target.value)}
              placeholder="Add excluded supplier"
            />
            <button onClick={addExcludedSupplier}>Add</button>
          </div>

          <div className="vat-mini-stats">
            <div>
              <span>VAT Eligible Spend</span>
              <strong>£{vatEligibleSpend.toFixed(2)}</strong>
            </div>

            <div>
              <span>VAT Estimate</span>
              <strong>£{vatEstimate.toFixed(2)}</strong>
            </div>

            <div>
              <span>Excluded Suppliers</span>
              <strong>{vatExcludedSuppliers.length}</strong>
            </div>
          </div>
        </div>

        <div className="files-breakdown-panel">
          <h3>Recent Files</h3>
          {recentFiles.length === 0 ? (
            <p className="soft-text">No files in this period.</p>
          ) : (
            <div className="transactionList">
              {recentFiles.map((file) => {
                const fileUrl = getFileUrl(file);

                return (
                  <div
                    className="transactionBox file-dashboard-row"
                    key={file.id || getFileName(file)}
                  >
                    <div>
                      <strong>{getFileName(file)}</strong>
                      <p>{file.supplier || "No supplier"}</p>
                      <p className="soft-text">
                        {getFileDate(file) || "No date"}
                      </p>
                    </div>

                    <div className="file-row-actions">
                      <strong>£{getFileTotal(file).toFixed(2)}</strong>
                      {fileUrl && (
                        <a href={fileUrl} target="_blank" rel="noreferrer">
                          Open
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default WelcomeScreen;
