import { useEffect, useMemo, useState } from "react";
import "./SpendExplorer.css";

const API_BASE = "";
const PAGE_SIZE = 8;

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const PERIODS = [
  { value: "all", label: "All year", months: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] },
  { value: "q1", label: "Jan – Mar", months: [0, 1, 2] },
  { value: "q2", label: "Apr – Jun", months: [3, 4, 5] },
  { value: "q3", label: "Jul – Sep", months: [6, 7, 8] },
  { value: "q4", label: "Oct – Dec", months: [9, 10, 11] },
  ...MONTHS.map((month, index) => ({
    value: `month-${index}`,
    label: month,
    months: [index],
  })),
];

const CATEGORY_COLOURS = {
  Materials: "#3b82f6",
  Labour: "#22c55e",
  Tools: "#a78bfa",
  Fuel: "#f97316",
  "Waste Removal": "#22d3ee",
  Waste: "#22d3ee",
  "PPE / Workwear": "#06b6d4",
  "Office / Admin": "#10b981",
  Advertising: "#ec4899",
  "Van Maintenance": "#0ea5e9",
  Untagged: "#94a3b8",
  Other: "#64748b",
};

function money(value, decimals = 2) {
  return Number(value || 0).toLocaleString("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function getDateKey(value) {
  if (!value) return null;

  const raw = String(value);
  const existingKey = raw.match(/^\d{4}-\d{2}-\d{2}/)?.[0];
  if (existingKey) return existingKey;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDate(dateKey) {
  if (!dateKey) return "No date";

  return new Date(`${dateKey}T12:00:00`).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function isFuelEntry(entry) {
  const haystack = `${entry.tag} ${entry.category}`.toLowerCase();
  return /fuel|petrol|diesel/.test(haystack);
}

function SpendCalendar({ jobs = [] }) {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedPeriod, setSelectedPeriod] = useState("all");
  const [search, setSearch] = useState("");
  const [transactionFilter, setTransactionFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [saveStatus, setSaveStatus] = useState("");

  useEffect(() => {
    loadFiles();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [selectedYear, selectedPeriod, search, transactionFilter]);

  useEffect(() => {
    function closeOnEscape(event) {
      if (event.key === "Escape") closeDrawer();
    }

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, []);

  async function loadFiles() {
    try {
      setLoading(true);
      setLoadError("");

      const response = await fetch(`${API_BASE}/api/files`);
      if (!response.ok) throw new Error("Could not load spending files");

      const data = await response.json();
      setFiles(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to fetch files:", error);
      setLoadError(error.message || "Could not load spending files");
    } finally {
      setLoading(false);
    }
  }

  function getJobName(jobId, fallback = "") {
    if (!jobId || jobId === "no-job") return "Business / General";

    const job = jobs.find((item) => String(item.id) === String(jobId));
    return job?.name || job?.address || fallback || `Job ${jobId}`;
  }

  const allEntries = useMemo(() => {
    const entries = [];

    files.forEach((file) => {
      const dateKey = getDateKey(file.purchaseDate || file.dateSorted);
      const links = Array.isArray(file.links) ? file.links : [];

      links.forEach((link, linkIndex) => {
        const isProject = link.targetType === "job";
        const jobId = isProject ? String(link.targetId) : "no-job";
        const rawCost = link.cost;
        const hasCost = rawCost !== null && rawCost !== undefined && rawCost !== "";
        const cost = hasCost && Number.isFinite(Number(rawCost)) ? Number(rawCost) : 0;
        const tag = link.tag || "Untagged";
        const category = link.category || "other";
        const supplier = file.supplier || "No supplier";
        const fileName = file.fileName || file.name || "Unnamed file";

        entries.push({
          id: `${file.id}-${linkIndex}`,
          fileId: file.id,
          linkIndex,
          fileName,
          fileUrl: file.url ? `${API_BASE}${file.url}` : "",
          mimeType: file.mimeType || "",
          dateKey,
          supplier,
          jobId,
          jobName: isProject
            ? getJobName(jobId, link.targetName)
            : "Business / General",
          isProject,
          category,
          tag,
          cost,
          note: link.note || "",
          hasMissingDetails:
            !dateKey ||
            !file.supplier ||
            !hasCost ||
            !link.tag ||
            !link.category,
        });
      });
    });

    return entries;
  }, [files, jobs]);

  const years = useMemo(() => {
    const found = new Set([new Date().getFullYear()]);

    allEntries.forEach((entry) => {
      if (entry.dateKey) found.add(Number(entry.dateKey.slice(0, 4)));
    });

    return Array.from(found).sort((a, b) => b - a);
  }, [allEntries]);

  const activePeriod =
    PERIODS.find((period) => period.value === selectedPeriod) || PERIODS[0];

  const periodEntries = useMemo(() => {
    return allEntries.filter((entry) => {
      if (!entry.dateKey) return false;

      const year = Number(entry.dateKey.slice(0, 4));
      const month = Number(entry.dateKey.slice(5, 7)) - 1;

      return year === Number(selectedYear) && activePeriod.months.includes(month);
    });
  }, [allEntries, selectedYear, activePeriod]);

  const summary = useMemo(() => {
    const total = periodEntries.reduce((sum, entry) => sum + entry.cost, 0);
    const project = periodEntries
      .filter((entry) => entry.isProject)
      .reduce((sum, entry) => sum + entry.cost, 0);
    const general = periodEntries
      .filter((entry) => !entry.isProject)
      .reduce((sum, entry) => sum + entry.cost, 0);
    const fuel = periodEntries
      .filter(isFuelEntry)
      .reduce((sum, entry) => sum + entry.cost, 0);
    const attentionFiles = new Set(
      periodEntries
        .filter((entry) => entry.hasMissingDetails)
        .map((entry) => String(entry.fileId)),
    ).size;

    return { total, project, general, fuel, attentionFiles };
  }, [periodEntries]);

  const monthlySpend = useMemo(() => {
    return activePeriod.months.map((monthIndex) => {
      const monthEntries = periodEntries.filter(
        (entry) => Number(entry.dateKey?.slice(5, 7)) - 1 === monthIndex,
      );

      const project = monthEntries
        .filter((entry) => entry.isProject)
        .reduce((sum, entry) => sum + entry.cost, 0);
      const general = monthEntries
        .filter((entry) => !entry.isProject)
        .reduce((sum, entry) => sum + entry.cost, 0);

      return {
        monthIndex,
        label: MONTHS[monthIndex],
        project,
        general,
        total: project + general,
      };
    });
  }, [periodEntries, activePeriod]);

  const maxMonthlySpend = Math.max(
    ...monthlySpend.map((month) => month.total),
    1,
  );

  const categoryTotals = useMemo(() => {
    const totals = {};

    periodEntries.forEach((entry) => {
      const category = entry.tag || "Untagged";
      totals[category] = (totals[category] || 0) + entry.cost;
    });

    return Object.entries(totals)
      .map(([name, total]) => ({
        name,
        total,
        colour: CATEGORY_COLOURS[name] || CATEGORY_COLOURS.Other,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 6);
  }, [periodEntries]);

  const maxCategoryTotal = Math.max(
    ...categoryTotals.map((category) => category.total),
    1,
  );

  const projectTotals = useMemo(() => {
    const totals = {};

    periodEntries
      .filter((entry) => entry.isProject)
      .forEach((entry) => {
        if (!totals[entry.jobId]) {
          totals[entry.jobId] = {
            jobId: entry.jobId,
            jobName: entry.jobName,
            total: 0,
            entries: 0,
          };
        }

        totals[entry.jobId].total += entry.cost;
        totals[entry.jobId].entries += 1;
      });

    return Object.values(totals).sort((a, b) => b.total - a.total);
  }, [periodEntries]);

  const maxProjectTotal = Math.max(
    ...projectTotals.map((project) => project.total),
    1,
  );

  const filteredTransactions = useMemo(() => {
    const query = search.trim().toLowerCase();

    return periodEntries
      .filter((entry) => {
        if (transactionFilter === "projects" && !entry.isProject) return false;
        if (transactionFilter === "general" && entry.isProject) return false;
        if (transactionFilter === "missing" && !entry.hasMissingDetails) {
          return false;
        }

        if (!query) return true;

        return [
          entry.supplier,
          entry.jobName,
          entry.category,
          entry.tag,
          entry.fileName,
          entry.note,
        ]
          .join(" ")
          .toLowerCase()
          .includes(query);
      })
      .sort((a, b) => {
        const dateComparison = String(b.dateKey || "").localeCompare(
          String(a.dateKey || ""),
        );

        if (dateComparison !== 0) return dateComparison;
        return b.cost - a.cost;
      });
  }, [periodEntries, search, transactionFilter]);

  const pageCount = Math.max(
    1,
    Math.ceil(filteredTransactions.length / PAGE_SIZE),
  );
  const safePage = Math.min(page, pageCount);
  const visibleTransactions = filteredTransactions.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE,
  );

  function openEntry(entry) {
    const file = files.find(
      (candidate) => String(candidate.id) === String(entry.fileId),
    );

    if (!file) return;

    const links = Array.isArray(file.links) ? file.links : [];

    setSelectedEntry({
      fileId: file.id,
      linkIndex: entry.linkIndex,
    });

    setEditForm({
      supplier: file.supplier || "",
      purchaseDate: getDateKey(file.purchaseDate || file.dateSorted) || "",
      links: links.map((link) => ({
        ...link,
        targetValue:
          link.targetType === "job"
            ? `job:${link.targetId}`
            : "general:no-job",
        category: link.category || "other",
        tag: link.tag || "",
        cost: link.cost ?? "",
        note: link.note || "",
      })),
    });

    setSaveStatus("");
  }

  function closeDrawer() {
    setSelectedEntry(null);
    setEditForm(null);
    setSaveStatus("");
  }

  function updateFileField(field, value) {
    setEditForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function updateAssignment(field, value) {
    if (!selectedEntry) return;

    setEditForm((current) => ({
      ...current,
      links: current.links.map((link, index) =>
        index === selectedEntry.linkIndex
          ? { ...link, [field]: value }
          : link,
      ),
    }));
  }

  async function saveFileChanges() {
    if (!selectedEntry || !editForm) return;

    try {
      setSaveStatus("Saving…");

      const cleanedLinks = editForm.links.map((link) => {
        const targetValue = link.targetValue || "general:no-job";
        const separatorIndex = targetValue.indexOf(":");
        const targetType = targetValue.slice(0, separatorIndex);
        const targetId = targetValue.slice(separatorIndex + 1);
        const matchedJob =
          targetType === "job"
            ? jobs.find((job) => String(job.id) === String(targetId))
            : null;

        return {
          targetType: targetType === "job" ? "job" : "general",
          targetId: targetType === "job" ? String(targetId) : "no-job",
          targetName:
            targetType === "job"
              ? matchedJob?.name ||
                matchedJob?.address ||
                `Job ${targetId}`
              : "Business / General",
          category: link.category || "other",
          tag: link.tag || "",
          cost: link.cost === "" ? null : Number(link.cost),
          note: link.note || "",
        };
      });

      const response = await fetch(
        `${API_BASE}/api/files/${selectedEntry.fileId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            supplier: editForm.supplier,
            purchaseDate: editForm.purchaseDate || null,
            links: cleanedLinks,
          }),
        },
      );

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Could not save file changes");
      }

      setFiles((current) =>
        current.map((file) =>
          String(file.id) === String(result.file.id) ? result.file : file,
        ),
      );
      setSaveStatus("Saved");
    } catch (error) {
      console.error("Could not update file:", error);
      setSaveStatus(error.message || "Could not save changes");
    }
  }

  const selectedFile = selectedEntry
    ? files.find(
        (file) => String(file.id) === String(selectedEntry.fileId),
      )
    : null;
  const selectedAssignment =
    selectedEntry && editForm
      ? editForm.links[selectedEntry.linkIndex]
      : null;

  function renderMetric({ label, value, detail, tone = "blue", warning = false }) {
    return (
      <div className={`se-metric se-tone-${tone}`}>
        <span>{label}</span>
        <strong className={warning ? "se-warning-value" : ""}>{value}</strong>
        <small>{detail}</small>
        <div className="se-metric-spark" aria-hidden="true">
          {[32, 55, 41, 76, 49, 68, 88, 44].map((height, index) => (
            <i key={index} style={{ height: `${height}%` }} />
          ))}
        </div>
      </div>
    );
  }

  function renderDrawer() {
    if (!selectedFile || !selectedAssignment || !editForm) return null;

    const fileName =
      selectedFile.fileName || selectedFile.name || "Supporting document";
    const fileUrl = selectedFile.url
      ? `${API_BASE}${selectedFile.url}`
      : "";
    const isImage =
      String(selectedFile.mimeType || "").startsWith("image/") ||
      /\.(png|jpe?g|gif|webp|bmp)$/i.test(fileName);

    return (
      <div className="se-drawer-backdrop" onClick={closeDrawer}>
        <aside className="se-drawer" onClick={(event) => event.stopPropagation()}>
          <header className="se-drawer-header">
            <div>
              <strong>{fileName}</strong>
              <span>Supporting document and transaction details</span>
            </div>
            <button type="button" onClick={closeDrawer} aria-label="Close">
              ×
            </button>
          </header>

          <div className="se-document-preview">
            {!fileUrl ? (
              <div className="se-empty-preview">No file preview available</div>
            ) : isImage ? (
              <img src={fileUrl} alt={fileName} />
            ) : (
              <iframe src={fileUrl} title={fileName} />
            )}
          </div>

          {fileUrl && (
            <a
              className="se-open-original"
              href={fileUrl}
              target="_blank"
              rel="noreferrer"
            >
              Open original document ↗
            </a>
          )}

          <div className="se-edit-form">
            <label>
              Supplier
              <input
                value={editForm.supplier}
                onChange={(event) =>
                  updateFileField("supplier", event.target.value)
                }
              />
            </label>

            <label>
              Purchase date
              <input
                type="date"
                value={editForm.purchaseDate}
                onChange={(event) =>
                  updateFileField("purchaseDate", event.target.value)
                }
              />
            </label>

            <label>
              Link to
              <select
                value={selectedAssignment.targetValue}
                onChange={(event) =>
                  updateAssignment("targetValue", event.target.value)
                }
              >
                <option value="general:no-job">Business / General</option>
                <optgroup label="Jobs">
                  {jobs.map((job) => (
                    <option key={job.id} value={`job:${job.id}`}>
                      {job.name || job.address || `Job ${job.id}`}
                    </option>
                  ))}
                </optgroup>
              </select>
            </label>

            <div className="se-form-grid">
              <label>
                File type
                <input
                  value={selectedAssignment.category}
                  onChange={(event) =>
                    updateAssignment("category", event.target.value)
                  }
                />
              </label>

              <label>
                Tag
                <input
                  value={selectedAssignment.tag}
                  onChange={(event) =>
                    updateAssignment("tag", event.target.value)
                  }
                />
              </label>
            </div>

            <label>
              Amount
              <input
                type="number"
                min="0"
                step="0.01"
                value={selectedAssignment.cost}
                onChange={(event) =>
                  updateAssignment("cost", event.target.value)
                }
              />
            </label>

            <label>
              Note
              <textarea
                rows="3"
                value={selectedAssignment.note}
                onChange={(event) =>
                  updateAssignment("note", event.target.value)
                }
              />
            </label>

            <div className="se-save-row">
              <button type="button" className="se-secondary" onClick={closeDrawer}>
                Cancel
              </button>
              <button type="button" className="se-primary" onClick={saveFileChanges}>
                Save changes
              </button>
            </div>

            {saveStatus && <p className="se-save-status">{saveStatus}</p>}
          </div>
        </aside>
      </div>
    );
  }

  if (loading) {
    return <div className="se-state">Loading spend explorer…</div>;
  }

  if (loadError) {
    return (
      <div className="se-state se-state-error">
        <strong>{loadError}</strong>
        <button type="button" onClick={loadFiles}>
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="se-page">
      {renderDrawer()}

      <header className="se-page-header">
        <div>
          <h2>Spend Explorer</h2>
          <p>Understand where the money went and find every supporting document.</p>
        </div>

        <div className="se-controls">
          <select
            aria-label="Year"
            value={selectedYear}
            onChange={(event) => setSelectedYear(Number(event.target.value))}
          >
            {years.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>

          <select
            aria-label="Period"
            value={selectedPeriod}
            onChange={(event) => setSelectedPeriod(event.target.value)}
          >
            {PERIODS.map((period) => (
              <option key={period.value} value={period.value}>
                {period.label}
              </option>
            ))}
          </select>

          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search supplier, job or receipt"
          />
        </div>
      </header>

      <section className="se-metrics">
        {renderMetric({
          label: "Total Spend",
          value: money(summary.total, 0),
          detail: activePeriod.label,
        })}
        {renderMetric({
          label: "Project Spend",
          value: money(summary.project, 0),
          detail: summary.total
            ? `${Math.round((summary.project / summary.total) * 100)}% of total`
            : "0% of total",
        })}
        {renderMetric({
          label: "Business / General",
          value: money(summary.general, 0),
          detail: summary.total
            ? `${Math.round((summary.general / summary.total) * 100)}% of total`
            : "0% of total",
          tone: "orange",
        })}
        {renderMetric({
          label: "Fuel Spend",
          value: money(summary.fuel, 0),
          detail: `Fuel in ${activePeriod.label.toLowerCase()}`,
          tone: "orange",
        })}
        {renderMetric({
          label: "Needs Attention",
          value: `${summary.attentionFiles} file${summary.attentionFiles === 1 ? "" : "s"}`,
          detail: "Missing details",
          tone: "red",
          warning: summary.attentionFiles > 0,
        })}
      </section>

      <section className="se-analysis-grid">
        <article className="se-panel se-spend-chart-panel">
          <div className="se-panel-heading">
            <div>
              <h3>Spend over time</h3>
              <p>
                <span className="se-legend-dot se-blue" /> Projects
                <span className="se-legend-dot se-orange" /> Business / General
              </p>
            </div>
          </div>

          <div className="se-bar-chart">
            {monthlySpend.map((month) => (
              <div className="se-month-column" key={month.monthIndex}>
                <div className="se-bar-value">
                  {month.total > 0 ? money(month.total, 0) : ""}
                </div>
                <div className="se-bar-track">
                  <div
                    className="se-bar-project"
                    style={{
                      height: `${(month.project / maxMonthlySpend) * 100}%`,
                    }}
                  />
                  <div
                    className="se-bar-general"
                    style={{
                      height: `${(month.general / maxMonthlySpend) * 100}%`,
                    }}
                  />
                </div>
                <span>{month.label}</span>
              </div>
            ))}
          </div>
        </article>

        <article className="se-panel">
          <div className="se-panel-heading">
            <h3>Spend by category</h3>
          </div>

          <div className="se-category-list">
            {categoryTotals.length === 0 ? (
              <p className="se-empty">No spending in this period.</p>
            ) : (
              categoryTotals.map((category) => (
                <div className="se-category-row" key={category.name}>
                  <span>{category.name}</span>
                  <div className="se-progress-track">
                    <i
                      style={{
                        width: `${(category.total / maxCategoryTotal) * 100}%`,
                        backgroundColor: category.colour,
                      }}
                    />
                  </div>
                  <strong>{money(category.total, 0)}</strong>
                </div>
              ))
            )}
          </div>
        </article>
      </section>

      <section className="se-lower-grid">
        <article className="se-panel se-transactions-panel">
          <div className="se-transaction-header">
            <h3>Transactions</h3>
            <div className="se-filter-tabs">
              {[
                ["all", "All"],
                ["projects", "Projects"],
                ["general", "Business / General"],
                ["missing", "Missing details"],
              ].map(([value, label]) => (
                <button
                  type="button"
                  key={value}
                  className={transactionFilter === value ? "active" : ""}
                  onClick={() => setTransactionFilter(value)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="se-table-wrap">
            <table className="se-transactions-table">
              <thead>
                <tr>
                  <th aria-label="Document" />
                  <th>Date</th>
                  <th>Supplier</th>
                  <th>Job</th>
                  <th>Category</th>
                  <th>Amount</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {visibleTransactions.map((entry) => (
                  <tr
                    key={entry.id}
                    className={
                      selectedEntry?.fileId === entry.fileId &&
                      selectedEntry?.linkIndex === entry.linkIndex
                        ? "selected"
                        : ""
                    }
                  >
                    <td>
                      <span className="se-file-icon">
                        {/\.(png|jpe?g|webp)$/i.test(entry.fileName)
                          ? "IMG"
                          : "PDF"}
                      </span>
                    </td>
                    <td data-label="Date">{formatDate(entry.dateKey)}</td>
                    <td data-label="Supplier">
                      <strong>{entry.supplier}</strong>
                      <small>{entry.fileName}</small>
                    </td>
                    <td data-label="Job">
                      <span
                        className={`se-chip ${
                          entry.isProject ? "se-chip-job" : "se-chip-general"
                        }`}
                      >
                        {entry.jobName}
                      </span>
                    </td>
                    <td data-label="Category">
                      <span className="se-category-cell">
                        <i
                          style={{
                            backgroundColor:
                              CATEGORY_COLOURS[entry.tag] ||
                              CATEGORY_COLOURS.Other,
                          }}
                        />
                        {entry.tag}
                      </span>
                    </td>
                    <td data-label="Amount">
                      <strong>{money(entry.cost)}</strong>
                    </td>
                    <td data-label="Action">
                      <button
                        type="button"
                        className="se-view-button"
                        onClick={() => openEntry(entry)}
                      >
                        View / edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredTransactions.length === 0 && (
            <p className="se-empty">No matching transactions.</p>
          )}

          <footer className="se-table-footer">
            <span>
              Showing {visibleTransactions.length} of {filteredTransactions.length} transactions
            </span>

            <div>
              <button
                type="button"
                disabled={safePage <= 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                Previous
              </button>
              <strong>
                {safePage} / {pageCount}
              </strong>
              <button
                type="button"
                disabled={safePage >= pageCount}
                onClick={() =>
                  setPage((current) => Math.min(pageCount, current + 1))
                }
              >
                Next
              </button>
            </div>
          </footer>
        </article>

        <article className="se-panel se-project-panel">
          <div className="se-panel-heading">
            <h3>Spend by project</h3>
          </div>

          <div className="se-project-list">
            {projectTotals.length === 0 ? (
              <p className="se-empty">No project spending in this period.</p>
            ) : (
              projectTotals.slice(0, 8).map((project, index) => (
                <div className="se-project-row" key={project.jobId}>
                  <span className="se-project-rank">{index + 1}</span>
                  <div>
                    <strong>{project.jobName}</strong>
                    <div className="se-progress-track">
                      <i
                        style={{
                          width: `${(project.total / maxProjectTotal) * 100}%`,
                        }}
                      />
                    </div>
                    <small>
                      {project.entries} transaction{project.entries === 1 ? "" : "s"}
                    </small>
                  </div>
                  <strong>{money(project.total, 0)}</strong>
                </div>
              ))
            )}
          </div>
        </article>
      </section>
    </div>
  );
}

export default SpendCalendar;
