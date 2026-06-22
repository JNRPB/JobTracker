import { useEffect, useMemo, useState } from "react";
import JobOverview from "./JobCardTabs/JobOverview";
import JobVisitReview from "./JobCardTabs/JobVisitReview";

const API_BASE = "http://192.168.0.22:3001";

function JobCard({
  job,
  onUpdate,
  deleteJob,
  onArchive,
  onUnarchive,
  navigate,
}) {
  const [activeTab, setActiveTab] = useState("overview");
  const [jobFiles, setJobFiles] = useState([]);

  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedSupplier, setSelectedSupplier] = useState("all");
  const [selectedMonth, setSelectedMonth] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");

  async function fetchJobFiles() {
    if (!job?.id) return;

    try {
      const res = await fetch(`${API_BASE}/api/files/job/${job.id}`);
      const data = await res.json();
      setJobFiles(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to fetch job files:", err);
    }
  }

  useEffect(() => {
    fetchJobFiles();
    setActiveTab("overview");
  }, [job?.id]);

  function getLinksForThisJob(file) {
    return (
      file.links?.filter(
        (link) =>
          link.targetType === "job" && String(link.targetId) === String(job.id),
      ) || []
    );
  }

  function getFileDate(file) {
    return file.purchaseDate || file.dateSorted || file.uploadedAt || "";
  }

  function getMonthValue(file) {
    const dateString = getFileDate(file);
    if (!dateString) return "no-date";

    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return "no-date";

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");

    return `${year}-${month}`;
  }

  function getMonthLabel(value) {
    if (value === "no-date") return "No date";

    const [year, month] = value.split("-");
    const date = new Date(Number(year), Number(month) - 1);

    return date.toLocaleDateString("en-GB", {
      month: "long",
      year: "numeric",
    });
  }

  function getFileLinkedCost(file) {
    const links = getLinksForThisJob(file);

    return links.reduce((sum, link) => {
      return sum + Number(link.cost || 0);
    }, 0);
  }

  const flattenedJobFiles = useMemo(() => {
    return jobFiles.flatMap((file) => {
      const links = getLinksForThisJob(file);

      return links.map((link, index) => ({
        id: `${file.id}-${index}`,
        file,
        link,
        fileName: file.fileName || file.name || "Unnamed file",
        supplier: file.supplier || "",
        date: getFileDate(file),
        month: getMonthValue(file),
        category: link.category || file.category || "uncategorised",
        note: link.note || "",
        cost: Number(link.cost || 0),
        url: file.url ? `${API_BASE}${file.url}` : "",
      }));
    });
  }, [jobFiles, job?.id]);

  const categoryOptions = useMemo(() => {
    return Array.from(
      new Set(flattenedJobFiles.map((item) => item.category).filter(Boolean)),
    ).sort();
  }, [flattenedJobFiles]);

  const supplierOptions = useMemo(() => {
    return Array.from(
      new Set(flattenedJobFiles.map((item) => item.supplier).filter(Boolean)),
    ).sort();
  }, [flattenedJobFiles]);

  const monthOptions = useMemo(() => {
    const months = Array.from(
      new Set(flattenedJobFiles.map((item) => item.month)),
    );

    return months
      .sort((a, b) => {
        if (a === "no-date") return 1;
        if (b === "no-date") return -1;
        return b.localeCompare(a);
      })
      .map((value) => ({
        value,
        label: getMonthLabel(value),
      }));
  }, [flattenedJobFiles]);

  const filteredJobFiles = flattenedJobFiles.filter((item) => {
    const matchesCategory =
      selectedCategory === "all" || item.category === selectedCategory;

    const matchesSupplier =
      selectedSupplier === "all" || item.supplier === selectedSupplier;

    const matchesMonth =
      selectedMonth === "all" || item.month === selectedMonth;

    const search = searchTerm.trim().toLowerCase();

    const matchesSearch =
      !search ||
      [
        item.fileName,
        item.supplier,
        item.date,
        item.category,
        item.note,
        item.cost,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(search);

    return matchesCategory && matchesSupplier && matchesMonth && matchesSearch;
  });

  const fileLinkedCost = flattenedJobFiles.reduce((sum, item) => {
    return sum + Number(item.cost || 0);
  }, 0);

  const filteredLinkedCost = filteredJobFiles.reduce((sum, item) => {
    return sum + Number(item.cost || 0);
  }, 0);

  const fileCount = jobFiles.length;
  const linkedItemCount = flattenedJobFiles.length;

  const missingCostCount = flattenedJobFiles.filter(
    (item) =>
      item.cost === 0 ||
      item.link.cost === null ||
      item.link.cost === undefined,
  ).length;

  const missingSupplierCount = flattenedJobFiles.filter(
    (item) => !item.supplier?.trim(),
  ).length;

  const missingDateCount = flattenedJobFiles.filter(
    (item) => !item.date,
  ).length;

  function clearFileFilters() {
    setSelectedCategory("all");
    setSelectedSupplier("all");
    setSelectedMonth("all");
    setSearchTerm("");
  }

  function renderTabButton(id, label, count = null) {
    return (
      <button
        type="button"
        className={`jobTabButton ${activeTab === id ? "active" : ""}`}
        onClick={() => setActiveTab(id)}
      >
        <span>{label}</span>
        {count !== null && <strong>{count}</strong>}
      </button>
    );
  }

  return (
    <>
      <div className="job-tab-shell">
        {renderTabButton("overview", "Overview")}
        {renderTabButton("review", "Visit Review")}
        {renderTabButton("files", "Files", fileCount)}
      </div>

      {activeTab === "overview" && (
        <JobOverview
          job={job}
          onUpdate={onUpdate}
          deleteJob={deleteJob}
          onArchive={onArchive}
          onUnarchive={onUnarchive}
          navigate={navigate}
          openVisitReview={() => setActiveTab("review")}
          jobFiles={jobFiles}
          fileCount={fileCount}
          fileLinkedCost={fileLinkedCost}
        />
      )}

      {activeTab === "review" && (
        <JobVisitReview
          jobId={job.id}
          navigate={navigate}
          backToOverview={() => setActiveTab("overview")}
        />
      )}

      {activeTab === "files" && (
        <div className="bubbleBox job-files-panel">
          <div className="job-files-header">
            <div>
              <h2>Job Files</h2>
              <p className="soft-text">
                Files, receipts, invoices and costs linked to this job.
              </p>
            </div>

            <button
              type="button"
              className="sleekButton primaryButton"
              onClick={() => navigate("UnsortedFiles")}
            >
              Upload / Sort Files
            </button>
          </div>

          <div className="files-stat-grid">
            <div className="file-stat-card">
              <h3>Total Cost</h3>
              <p>£{fileLinkedCost.toFixed(2)}</p>
            </div>

            <div className="file-stat-card">
              <h3>Filtered Cost</h3>
              <p>£{filteredLinkedCost.toFixed(2)}</p>
            </div>

            <div className="file-stat-card">
              <h3>Files</h3>
              <p>{fileCount}</p>
            </div>

            <div className="file-stat-card">
              <h3>Linked Items</h3>
              <p>{linkedItemCount}</p>
            </div>
          </div>

          <div className="files-warning-grid">
            {missingCostCount > 0 && (
              <div className="invoiceWarning fileWarningItem">
                ⚠️ {missingCostCount} linked item
                {missingCostCount !== 1 ? "s" : ""} with missing cost
              </div>
            )}

            {missingSupplierCount > 0 && (
              <div className="invoiceWarning fileWarningItem">
                ⚠️ {missingSupplierCount} linked item
                {missingSupplierCount !== 1 ? "s" : ""} with missing supplier
              </div>
            )}

            {missingDateCount > 0 && (
              <div className="invoiceWarning fileWarningItem">
                ⚠️ {missingDateCount} linked item
                {missingDateCount !== 1 ? "s" : ""} with missing date
              </div>
            )}
          </div>

          <div className="invoiceFilters">
            <div className="invoiceFilterGroup wide">
              <label>Search</label>
              <input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search file, supplier, type, note..."
              />
            </div>

            <div className="invoiceFilterGroup">
              <label>Month</label>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
              >
                <option value="all">All months</option>

                {monthOptions.map((month) => (
                  <option key={month.value} value={month.value}>
                    {month.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="invoiceFilterGroup">
              <label>Supplier</label>
              <select
                value={selectedSupplier}
                onChange={(e) => setSelectedSupplier(e.target.value)}
              >
                <option value="all">All suppliers</option>

                {supplierOptions.map((supplier) => (
                  <option key={supplier} value={supplier}>
                    {supplier}
                  </option>
                ))}
              </select>
            </div>

            <div className="invoiceFilterGroup">
              <label>File Type</label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
              >
                <option value="all">All file types</option>

                {categoryOptions.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>

            <button className="invoiceClearFilters" onClick={clearFileFilters}>
              Clear
            </button>
          </div>

          {filteredJobFiles.length === 0 ? (
            <div className="emptyInvoices">No files match these filters.</div>
          ) : (
            <div className="transactionList">
              {filteredJobFiles.map((item) => (
                <div className="transactionBox job-file-row" key={item.id}>
                  <div className="transactionMiddle">
                    <p className="transactionName">{item.fileName}</p>

                    <p className="invoiceItemName">
                      {item.category || "uncategorised"}
                    </p>

                    {item.supplier ? (
                      <p className="invoiceItemName">
                        Supplier: {item.supplier}
                      </p>
                    ) : (
                      <p className="invoiceItemName warningText">
                        Missing supplier
                      </p>
                    )}

                    {item.date ? (
                      <p className="invoiceItemName">Date: {item.date}</p>
                    ) : (
                      <p className="invoiceItemName warningText">
                        Missing date
                      </p>
                    )}

                    {item.note && (
                      <p className="invoiceItemName">Note: {item.note}</p>
                    )}
                  </div>

                  <div className="transactionRight job-file-actions">
                    {item.cost > 0 ? (
                      <p className="transactionAmount">
                        £{item.cost.toFixed(2)}
                      </p>
                    ) : (
                      <p className="transactionAmount warningText">No cost</p>
                    )}

                    {item.url ? (
                      <a
                        className="sleekMiniLink"
                        href={item.url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Open
                      </a>
                    ) : (
                      <span className="soft-text">No URL</span>
                    )}

                    <button
                      type="button"
                      className="sleekButton primaryButton"
                      onClick={() => navigate("Files")}
                    >
                      Edit in Files
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}

export default JobCard;
