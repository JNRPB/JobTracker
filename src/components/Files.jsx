import { useEffect, useMemo, useState } from "react";
import SideBarButton from "./SideBarButton";

const API_BASE = "";

const tagOptions = [
  "Fuel",
  "PPE / Workwear",
  "Waste Removal",
  "Tools",
  "Office / Admin",
  "Advertising",
  "Van Maintenance",
  "Labour",
  "Materials",
];

const fileCategories = [
  "invoice",
  "receipt",
  "quote",
  "photo",
  "drawing",
  "certificate",
  "licence",
  "other",
];

function Files({ jobs = [], navigate, navData }) {
  const [loggedFiles, setLoggedFiles] = useState([]);
  const [selectedTag, setSelectedTag] = useState(navData?.tag || "all");
  const [selectedJobId, setSelectedJobId] = useState("all");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedMonth, setSelectedMonth] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState("list");
  const [warningView, setWarningView] = useState("all");

  const [editingFileId, setEditingFileId] = useState(null);
  const [editForm, setEditForm] = useState({
    supplier: "",
    purchaseDate: "",
    links: [],
  });

  useEffect(() => {
    fetchLoggedFiles();
  }, []);

  useEffect(() => {
    if (navData?.tag) {
      setSelectedTag(navData.tag);
      setSelectedJobId("all");
      setSelectedCategory("all");
      setSelectedMonth("all");
      setSearchTerm("");
      setWarningView("all");
    }
  }, [navData]);

  async function fetchLoggedFiles() {
    try {
      const res = await fetch(`${API_BASE}/api/files`);
      const data = await res.json();
      setLoggedFiles(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to fetch logged files:", err);
    }
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

  function getJobName(jobId) {
    const job = jobs.find((job) => String(job.id) === String(jobId));
    return job?.name || job?.address || `Job ${jobId}`;
  }

  function getTargetName(link) {
    if (link.targetType === "job") {
      return link.targetName || getJobName(link.targetId);
    }

    return "No Job Link";
  }

  function getFileTotal(file) {
    const links = Array.isArray(file.links) ? file.links : [];
    return links.reduce((sum, link) => sum + Number(link.cost || 0), 0);
  }

  function getVatFromGross(gross) {
    return Number(gross || 0) / 6;
  }

  function getNetFromGross(gross) {
    return Number(gross || 0) - getVatFromGross(gross);
  }

  function getMonthValue(file) {
    const dateString = getFileDate(file);
    if (!dateString) return "no-date";

    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "no-date";

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

  function getDefaultLink() {
    return {
      targetType: "general",
      targetId: "no-job",
      targetName: "No Job Link",
      category: "other",
      tag: "",
      cost: "",
      note: "",
    };
  }

  function normaliseOldLink(link) {
    if (link.targetType === "business") {
      return {
        targetType: "general",
        targetId: "no-job",
        targetName: "No Job Link",
        category: normaliseOldCategory(link.category),
        tag: normaliseOldBusinessTag(link.targetId, link.targetName),
        cost: link.cost ?? "",
        note: link.note || "",
      };
    }

    return {
      targetType: link.targetType || "general",
      targetId: link.targetId || "no-job",
      targetName: link.targetName || "",
      category: normaliseOldCategory(link.category),
      tag: link.tag || "",
      cost: link.cost ?? "",
      note: link.note || "",
    };
  }

  function normaliseOldCategory(category) {
    const value = String(category || "")
      .trim()
      .toLowerCase();

    if (fileCategories.includes(value)) return value;

    if (value === "materials") return "invoice";
    if (value === "van") return "receipt";
    if (value === "ppe") return "receipt";
    if (value === "office / admin") return "receipt";
    if (value === "insurance") return "receipt";
    if (value === "accounting") return "receipt";
    if (value === "tools") return "receipt";
    if (value === "fuel") return "receipt";
    if (value === "other") return "other";

    return "other";
  }

  function normaliseOldBusinessTag(targetId, targetName) {
    const value = String(targetId || targetName || "").toLowerCase();

    if (value.includes("fuel")) return "Fuel";
    if (value.includes("ppe") || value.includes("workwear"))
      return "PPE / Workwear";
    if (value.includes("tool")) return "Tools";
    if (value.includes("van")) return "Van Maintenance";
    if (value.includes("office") || value.includes("admin"))
      return "Office / Admin";
    if (value.includes("advert")) return "Advertising";
    if (value.includes("labour") || value.includes("labor")) return "Labour";
    if (value.includes("waste")) return "Waste Removal";

    return "";
  }

  function startEditingFile(file) {
    setEditingFileId(file.id);

    setEditForm({
      supplier: file.supplier || "",
      purchaseDate: file.purchaseDate || "",
      links:
        Array.isArray(file.links) && file.links.length > 0
          ? file.links.map(normaliseOldLink)
          : [getDefaultLink()],
    });
  }

  function cancelEditingFile() {
    setEditingFileId(null);
    setEditForm({
      supplier: "",
      purchaseDate: "",
      links: [],
    });
  }

  function updateEditLink(index, field, value) {
    setEditForm((current) => {
      const updatedLinks = [...current.links];

      updatedLinks[index] = {
        ...updatedLinks[index],
        [field]: value,
      };

      if (field === "targetValue") {
        const [targetType, targetId] = value.split(":");

        if (targetType === "job") {
          updatedLinks[index].targetType = "job";
          updatedLinks[index].targetId = targetId;
          updatedLinks[index].targetName = getJobName(targetId);
        }

        if (targetType === "general") {
          updatedLinks[index].targetType = "general";
          updatedLinks[index].targetId = "no-job";
          updatedLinks[index].targetName = "No Job Link";
        }
      }

      return {
        ...current,
        links: updatedLinks,
      };
    });
  }

  function addEditLink() {
    setEditForm((current) => ({
      ...current,
      links: [...current.links, getDefaultLink()],
    }));
  }

  function removeEditLink(index) {
    setEditForm((current) => ({
      ...current,
      links: current.links.filter((_, linkIndex) => linkIndex !== index),
    }));
  }

  function getTargetValue(link) {
    if (link.targetType === "job") return `job:${link.targetId}`;
    return "general:no-job";
  }

  async function saveFileEdit(file) {
    try {
      const cleanedLinks = editForm.links
        .filter(
          (link) =>
            link.targetType && link.targetId && link.category && link.tag,
        )
        .map((link) => {
          let targetName = "No Job Link";

          if (link.targetType === "job") {
            targetName = getJobName(link.targetId);
          }

          return {
            targetType: link.targetType === "job" ? "job" : "general",
            targetId:
              link.targetType === "job" ? String(link.targetId) : "no-job",
            targetName,
            category: link.category || "other",
            tag: link.tag || "",
            cost: link.cost === "" ? null : Number(link.cost),
            note: link.note || "",
          };
        });

      const updatedFile = {
        ...file,
        supplier: editForm.supplier,
        purchaseDate: editForm.purchaseDate || null,
        links: cleanedLinks.length > 0 ? cleanedLinks : [getDefaultLink()],
      };

      const res = await fetch(`${API_BASE}/api/files/${file.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updatedFile),
      });

      if (!res.ok) {
        throw new Error("Failed to update file");
      }

      const data = await res.json();

      setLoggedFiles((currentFiles) =>
        currentFiles.map((item) =>
          String(item.id) === String(file.id) ? data.file : item,
        ),
      );

      cancelEditingFile();
    } catch (err) {
      console.error("Failed to update file:", err);
      alert("Could not update this file.");
    }
  }

  async function deleteFile(file) {
    const confirmed = window.confirm(
      `Delete "${getFileName(file)}"?\n\nThis will remove it from the dashboard and delete the stored file.`,
    );

    if (!confirmed) return;

    try {
      const res = await fetch(`${API_BASE}/api/files/${file.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        throw new Error("Delete failed");
      }

      setLoggedFiles((currentFiles) =>
        currentFiles.filter((item) => String(item.id) !== String(file.id)),
      );
    } catch (err) {
      console.error("Failed to delete file:", err);
      alert("Could not delete this file.");
    }
  }

  function clearFilters() {
    setSelectedTag("all");
    setSelectedJobId("all");
    setSelectedCategory("all");
    setSelectedMonth("all");
    setSearchTerm("");
    setWarningView("all");
  }

  function viewWarning(type) {
    setWarningView(type);
    setSelectedTag("all");
    setSelectedJobId("all");
    setSelectedCategory("all");
    setSelectedMonth("all");
    setSearchTerm("");
  }

  function fileHasMissingCost(file) {
    const links = Array.isArray(file.links) ? file.links : [];
    return (
      links.length === 0 ||
      links.some(
        (link) =>
          link.cost === null || link.cost === undefined || link.cost === "",
      )
    );
  }

  function fileHasMissingSupplier(file) {
    return !file.supplier?.trim();
  }

  function fileHasMissingDate(file) {
    return !getFileDate(file);
  }

  function fileHasMissingTag(file) {
    const links = Array.isArray(file.links) ? file.links : [];
    return links.length === 0 || links.some((link) => !link.tag);
  }

  const warningCounts = useMemo(() => {
    return {
      missingCost: loggedFiles.filter(fileHasMissingCost).length,
      missingSupplier: loggedFiles.filter(fileHasMissingSupplier).length,
      missingDate: loggedFiles.filter(fileHasMissingDate).length,
      missingTag: loggedFiles.filter(fileHasMissingTag).length,
    };
  }, [loggedFiles]);

  const jobOptions = useMemo(() => {
    const ids = new Set();

    loggedFiles.forEach((file) => {
      const links = Array.isArray(file.links) ? file.links : [];

      links.forEach((link) => {
        if (link.targetType === "job" && link.targetId) {
          ids.add(String(link.targetId));
        }
      });
    });

    return jobs
      .filter((job) => ids.has(String(job.id)))
      .map((job) => ({
        value: String(job.id),
        label: job.name || job.address || `Job ${job.id}`,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [loggedFiles, jobs]);

  const categoryOptions = useMemo(() => {
    const categories = new Set();

    loggedFiles.forEach((file) => {
      const links = Array.isArray(file.links) ? file.links : [];

      links.forEach((link) => {
        if (link.category) categories.add(link.category);
      });
    });

    return Array.from(categories).sort();
  }, [loggedFiles]);

  const monthOptions = useMemo(() => {
    const months = new Set();

    loggedFiles.forEach((file) => {
      months.add(getMonthValue(file));
    });

    return Array.from(months)
      .sort((a, b) => {
        if (a === "no-date") return 1;
        if (b === "no-date") return -1;
        return b.localeCompare(a);
      })
      .map((value) => ({
        value,
        label: getMonthLabel(value),
      }));
  }, [loggedFiles]);

  function fileMatchesTag(file) {
    if (selectedTag === "all") return true;

    const links = Array.isArray(file.links) ? file.links : [];

    return links.some((link) => link.tag === selectedTag);
  }

  function fileMatchesJob(file) {
    if (selectedJobId === "all") return true;

    const links = Array.isArray(file.links) ? file.links : [];

    if (selectedJobId === "no-job") {
      return links.some((link) => link.targetType !== "job");
    }

    return links.some(
      (link) =>
        link.targetType === "job" &&
        String(link.targetId) === String(selectedJobId),
    );
  }

  function fileMatchesCategory(file) {
    if (selectedCategory === "all") return true;

    const links = Array.isArray(file.links) ? file.links : [];

    return links.some((link) => link.category === selectedCategory);
  }

  function fileMatchesMonth(file) {
    if (selectedMonth === "all") return true;
    return getMonthValue(file) === selectedMonth;
  }

  function fileMatchesSearch(file) {
    if (!searchTerm.trim()) return true;

    const search = searchTerm.toLowerCase();
    const links = Array.isArray(file.links) ? file.links : [];

    const haystack = [
      getFileName(file),
      file.supplier,
      getFileDate(file),
      ...links.flatMap((link) => [
        link.targetName,
        link.targetId,
        link.category,
        link.tag,
        link.note,
      ]),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return haystack.includes(search);
  }

  function fileMatchesWarning(file) {
    if (warningView === "all") return true;
    if (warningView === "missing-cost") return fileHasMissingCost(file);
    if (warningView === "missing-supplier") return fileHasMissingSupplier(file);
    if (warningView === "missing-date") return fileHasMissingDate(file);
    if (warningView === "missing-tag") return fileHasMissingTag(file);
    return true;
  }

  const filteredFiles = loggedFiles.filter((file) => {
    return (
      fileMatchesWarning(file) &&
      fileMatchesTag(file) &&
      fileMatchesJob(file) &&
      fileMatchesCategory(file) &&
      fileMatchesMonth(file) &&
      fileMatchesSearch(file)
    );
  });

  const filteredTotal = filteredFiles.reduce((sum, file) => {
    return sum + getFileTotal(file);
  }, 0);

  const filteredVat = getVatFromGross(filteredTotal);
  const filteredNet = getNetFromGross(filteredTotal);

  const tagBreakdown = tagOptions
    .map((tag) => {
      const total = filteredFiles.reduce((sum, file) => {
        const links = Array.isArray(file.links) ? file.links : [];

        const tagTotal = links
          .filter((link) => link.tag === tag)
          .reduce((linkSum, link) => linkSum + Number(link.cost || 0), 0);

        return sum + tagTotal;
      }, 0);

      return {
        tag,
        total,
      };
    })
    .filter((item) => item.total > 0)
    .sort((a, b) => b.total - a.total);

  const monthlySpend = useMemo(() => {
    const totals = {};

    loggedFiles.forEach((file) => {
      const month = getMonthValue(file);
      if (month === "no-date") return;

      totals[month] = (totals[month] || 0) + getFileTotal(file);
    });

    return Object.entries(totals)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([month, total]) => ({
        month,
        label: getMonthLabel(month).split(" ")[0],
        total,
      }));
  }, [loggedFiles]);

  const maxMonthlySpend = Math.max(
    ...monthlySpend.map((item) => item.total),
    1,
  );

  const groupedByJob = filteredFiles.reduce((acc, file) => {
    const links = Array.isArray(file.links) ? file.links : [];
    const jobLinks = links.filter((link) => link.targetType === "job");

    if (jobLinks.length === 0) {
      if (!acc["no-job"]) {
        acc["no-job"] = {
          title: "No Job Link",
          files: [],
          total: 0,
        };
      }

      acc["no-job"].files.push(file);
      acc["no-job"].total += getFileTotal(file);
      return acc;
    }

    jobLinks.forEach((link) => {
      const key = String(link.targetId);
      const title = link.targetName || getJobName(link.targetId);

      if (!acc[key]) {
        acc[key] = {
          title,
          files: [],
          total: 0,
        };
      }

      acc[key].files.push(file);
      acc[key].total += Number(link.cost || 0);
    });

    return acc;
  }, {});

  function exportCsv() {
    const rows = [
      [
        "File",
        "Supplier",
        "Date",
        "Link Type",
        "Linked To",
        "File Type",
        "Tag",
        "Gross",
        "VAT",
        "Net",
        "Note",
      ],
    ];

    filteredFiles.forEach((file) => {
      const links = Array.isArray(file.links) ? file.links : [];

      links.forEach((link) => {
        const gross = Number(link.cost || 0);
        const vat = getVatFromGross(gross);
        const net = getNetFromGross(gross);

        rows.push([
          getFileName(file),
          file.supplier || "",
          getFileDate(file) || "",
          link.targetType === "job" ? "Job" : "No Job Link",
          getTargetName(link),
          link.category || "",
          link.tag || "",
          gross.toFixed(2),
          vat.toFixed(2),
          net.toFixed(2),
          link.note || "",
        ]);
      });
    });

    const csv = rows
      .map((row) =>
        row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","),
      )
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = "files-export.csv";
    link.click();

    URL.revokeObjectURL(url);
  }

  function getWarningLabel() {
    if (warningView === "missing-cost")
      return "Showing files with missing cost";
    if (warningView === "missing-supplier")
      return "Showing files with missing supplier";
    if (warningView === "missing-date")
      return "Showing files with missing date";
    if (warningView === "missing-tag") return "Showing files with missing tag";
    return "";
  }

  function renderWarningCard(type, count, text) {
    if (count <= 0) return null;

    return (
      <div className="invoiceWarning fileWarningItem">
        <span>
          ⚠️ {count} file{count !== 1 ? "s" : ""} {text}
        </span>

        <button
          type="button"
          className="warningViewButton"
          onClick={() => viewWarning(type)}
        >
          View
        </button>
      </div>
    );
  }

  function renderSpendGraph() {
    return (
      <div className="files-graph-panel">
        <div className="files-graph-header">
          <div>
            <h3>Monthly Spend</h3>
            <p className="soft-text">Last 6 months from logged files</p>
          </div>
        </div>

        {monthlySpend.length === 0 ? (
          <p className="soft-text">No dated spend yet.</p>
        ) : (
          <div className="files-bar-chart">
            {monthlySpend.map((item) => {
              const height = Math.max((item.total / maxMonthlySpend) * 100, 6);

              return (
                <div className="files-bar-item" key={item.month}>
                  <div className="files-bar-value">
                    £{item.total.toFixed(0)}
                  </div>

                  <div className="files-bar-track">
                    <div
                      className="files-bar-fill"
                      style={{ height: `${height}%` }}
                    />
                  </div>

                  <div className="files-bar-label">{item.label}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  function renderEditPanel(file) {
    return (
      <div className="file-edit-panel">
        <div className="file-edit-main">
          <div className="file-edit-field">
            <label>Supplier</label>
            <input
              value={editForm.supplier}
              onChange={(e) =>
                setEditForm({
                  ...editForm,
                  supplier: e.target.value,
                })
              }
              placeholder="Supplier"
            />
          </div>

          <div className="file-edit-field">
            <label>Purchase Date</label>
            <input
              type="date"
              value={editForm.purchaseDate || ""}
              onChange={(e) =>
                setEditForm({
                  ...editForm,
                  purchaseDate: e.target.value,
                })
              }
            />
          </div>
        </div>

        <div className="file-edit-links">
          <div className="file-edit-links-header">
            <h4>Assignments</h4>

            <button
              type="button"
              className="addLinkButton"
              onClick={addEditLink}
            >
              + Add assignment
            </button>
          </div>

          {editForm.links.map((link, index) => (
            <div className="file-edit-link-row" key={index}>
              <div className="file-edit-field wide">
                <label>Link To</label>

                <select
                  value={getTargetValue(link)}
                  onChange={(e) =>
                    updateEditLink(index, "targetValue", e.target.value)
                  }
                >
                  <option value="">Select job link</option>
                  <option value="general:no-job">No Job Link</option>

                  <optgroup label="Jobs">
                    {jobs.map((job) => (
                      <option key={job.id} value={`job:${job.id}`}>
                        {job.name || job.address || `Job ${job.id}`}
                      </option>
                    ))}
                  </optgroup>
                </select>
              </div>

              <div className="file-edit-field">
                <label>File Type</label>
                <select
                  value={link.category}
                  onChange={(e) =>
                    updateEditLink(index, "category", e.target.value)
                  }
                >
                  <option value="">Select file type</option>

                  {fileCategories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>

              <div className="file-edit-field">
                <label>Tag</label>
                <select
                  value={link.tag}
                  onChange={(e) => updateEditLink(index, "tag", e.target.value)}
                >
                  <option value="">Select tag</option>

                  {tagOptions.map((tag) => (
                    <option key={tag} value={tag}>
                      {tag}
                    </option>
                  ))}
                </select>
              </div>

              <div className="file-edit-field small">
                <label>Cost</label>
                <input
                  type="number"
                  step="0.01"
                  value={link.cost}
                  onChange={(e) =>
                    updateEditLink(index, "cost", e.target.value)
                  }
                  placeholder="0.00"
                />
              </div>

              <div className="file-edit-field wide">
                <label>Note</label>
                <input
                  value={link.note}
                  onChange={(e) =>
                    updateEditLink(index, "note", e.target.value)
                  }
                  placeholder="Optional note"
                />
              </div>

              <button
                type="button"
                className="removeLinkButton"
                onClick={() => removeEditLink(index)}
              >
                Remove
              </button>
            </div>
          ))}
        </div>

        <div className="file-edit-actions">
          <button
            type="button"
            className="saveFileButton"
            onClick={() => saveFileEdit(file)}
          >
            Save Changes
          </button>

          <button
            type="button"
            className="cancelFileButton"
            onClick={cancelEditingFile}
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  function renderFileSummary(file) {
    const links = Array.isArray(file.links) ? file.links : [];

    return (
      <>
        <p>{file.supplier || "No supplier"}</p>
        <p>{getFileDate(file) || "No date"}</p>

        {links.map((link, index) => (
          <div key={index} className="soft-text">
            {getTargetName(link)}
            {" — "}
            {link.category || "no file type"}
            {" — "}
            {link.tag || "no tag"}
            {link.cost ? ` — £${Number(link.cost).toFixed(2)}` : " — no cost"}
            {link.note ? ` — ${link.note}` : ""}
          </div>
        ))}
      </>
    );
  }

  function renderFileActions(file) {
    const fileUrl = getFileUrl(file);
    const isEditing = String(editingFileId) === String(file.id);

    return (
      <div className="file-row-actions">
        <strong>£{getFileTotal(file).toFixed(2)}</strong>

        {fileUrl ? (
          <a href={fileUrl} target="_blank" rel="noreferrer">
            Open
          </a>
        ) : (
          <span className="soft-text">No URL</span>
        )}

        {!isEditing && (
          <>
            <button
              type="button"
              className="editFileButton"
              onClick={() => startEditingFile(file)}
            >
              Edit
            </button>

            <button
              type="button"
              className="deleteFileButton"
              onClick={() => deleteFile(file)}
            >
              Delete
            </button>
          </>
        )}
      </div>
    );
  }

  function renderFileRow(file, keyPrefix = "") {
    const isEditing = String(editingFileId) === String(file.id);

    return (
      <div
        className={`transactionBox file-dashboard-row ${
          isEditing ? "file-dashboard-row-editing" : ""
        }`}
        key={`${keyPrefix}${file.id || getFileName(file)}`}
      >
        <div className="file-row-main">
          <strong>{getFileName(file)}</strong>
          {isEditing ? renderEditPanel(file) : renderFileSummary(file)}
        </div>

        {renderFileActions(file)}
      </div>
    );
  }

  return (
    <div className="widget files-dashboard">
      <div className="files-header">
        <div>
          <h2>Files Dashboard</h2>
          <p className="soft-text">
            Search, filter, total up costs, and keep your business records tidy.
          </p>
        </div>

        <SideBarButton
          label="Upload / Sort Files"
          component="UnsortedFiles"
          navigate={navigate}
        />
      </div>

      <div className="files-stat-grid">
        <div className="file-stat-card">
          <h3>Total Spend</h3>
          <p>£{filteredTotal.toFixed(2)}</p>
        </div>

        <div className="file-stat-card">
          <h3>VAT Estimate</h3>
          <p>£{filteredVat.toFixed(2)}</p>
        </div>

        <div className="file-stat-card">
          <h3>Net Estimate</h3>
          <p>£{filteredNet.toFixed(2)}</p>
        </div>

        <div className="file-stat-card">
          <h3>Files</h3>
          <p>{filteredFiles.length}</p>
        </div>
      </div>

      <div className="files-warning-grid">
        {renderWarningCard(
          "missing-cost",
          warningCounts.missingCost,
          "with missing cost",
        )}
        {renderWarningCard(
          "missing-supplier",
          warningCounts.missingSupplier,
          "with missing supplier",
        )}
        {renderWarningCard(
          "missing-date",
          warningCounts.missingDate,
          "with missing date",
        )}
        {renderWarningCard(
          "missing-tag",
          warningCounts.missingTag,
          "with missing tag",
        )}
      </div>

      {warningView !== "all" && (
        <div className="warning-view-banner">
          <span>{getWarningLabel()}</span>

          <button type="button" onClick={() => setWarningView("all")}>
            Clear view
          </button>
        </div>
      )}

      <div className="invoiceFilters">
        <div className="invoiceFilterGroup wide">
          <label>Search</label>
          <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search supplier, file name, note, job, tag..."
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
          <label>Tag</label>
          <select
            value={selectedTag}
            onChange={(e) => setSelectedTag(e.target.value)}
          >
            <option value="all">All tags</option>

            {tagOptions.map((tag) => (
              <option key={tag} value={tag}>
                {tag}
              </option>
            ))}
          </select>
        </div>

        <div className="invoiceFilterGroup">
          <label>Job Link</label>
          <select
            value={selectedJobId}
            onChange={(e) => setSelectedJobId(e.target.value)}
          >
            <option value="all">All job links</option>
            <option value="no-job">No Job Link</option>

            {jobOptions.map((job) => (
              <option key={job.value} value={job.value}>
                {job.label}
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

        <button className="invoiceClearFilters" onClick={clearFilters}>
          Clear
        </button>

        <button className="invoiceClearFilters" onClick={exportCsv}>
          Export CSV
        </button>
      </div>

      {renderSpendGraph()}

      <div className="files-breakdown-panel">
        <h3>Tag Breakdown</h3>

        {tagBreakdown.length === 0 ? (
          <p className="soft-text">No tagged spend in this view.</p>
        ) : (
          <div className="files-breakdown-grid">
            {tagBreakdown.map((item) => (
              <div className="files-breakdown-card" key={item.tag}>
                <span>{item.tag}</span>
                <strong>£{item.total.toFixed(2)}</strong>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="files-view-toggle">
        <button
          className={viewMode === "list" ? "active" : ""}
          onClick={() => setViewMode("list")}
        >
          List View
        </button>

        <button
          className={viewMode === "job" ? "active" : ""}
          onClick={() => setViewMode("job")}
        >
          Group by Job
        </button>
      </div>

      {viewMode === "list" ? (
        <div className="transactionList">
          {filteredFiles.length === 0 ? (
            <div className="emptyInvoices">No files match these filters.</div>
          ) : (
            filteredFiles.map((file) => renderFileRow(file))
          )}
        </div>
      ) : (
        <div className="transactionList">
          {Object.entries(groupedByJob).length === 0 ? (
            <div className="emptyInvoices">No grouped files to show.</div>
          ) : (
            Object.entries(groupedByJob).map(([key, group]) => (
              <div className="files-job-group" key={key}>
                <div className="files-job-group-header">
                  <h3>{group.title}</h3>
                  <strong>£{group.total.toFixed(2)}</strong>
                </div>

                {group.files.map((file) => renderFileRow(file, `${key}-`))}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default Files;

