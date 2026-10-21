import { useEffect, useState } from "react";
import "./UnsortedFiles.css";
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
const linkCategories = [
  "invoice",
  "receipt",
  "quote",
  "photo",
  "drawing",
  "certificate",
  "licence",
  "other",
];
const costApplicableCategories = ["invoice", "receipt", "other"];
const VAT_TREATMENTS = [
  { value: "unreviewed", label: "Choose VAT treatment" },
  { value: "standard", label: "Standard VAT · 20%" },
  { value: "reduced", label: "Reduced VAT · 5%" },
  { value: "zero", label: "Zero-rated · 0%" },
  { value: "exempt", label: "VAT exempt · 0%" },
  { value: "no-vat", label: "No VAT / supplier not registered" },
  { value: "custom", label: "Custom VAT amount" },
];
function roundMoney(value) {
  return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
}
function calculateVatRecord(grossValue, treatment, customVatAmount = "") {
  const gross = roundMoney(Math.max(Number(grossValue || 0), 0));
  if (!treatment || treatment === "unreviewed") {
    return {
      reviewed: false,
      status: "unknown",
      rate: null,
      amount: null,
      net: null,
      reviewedAt: null,
    };
  }
  let rate = 0;
  let amount = 0;
  if (treatment === "standard") {
    rate = 20;
    amount = gross - gross / 1.2;
  } else if (treatment === "reduced") {
    rate = 5;
    amount = gross - gross / 1.05;
  } else if (treatment === "custom") {
    rate = null;
    amount = Math.min(Math.max(Number(customVatAmount || 0), 0), gross);
  }
  amount = roundMoney(amount);
  return {
    reviewed: true,
    status: treatment,
    rate,
    amount,
    net: roundMoney(gross - amount),
    reviewedAt: new Date().toISOString(),
  };
}
function formatFileSize(bytes) {
  const size = Number(bytes || 0);
  if (!size) return "Size unavailable";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}
function formatInboxDate(value) {
  if (!value) return "Recently uploaded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Recently uploaded";
  }
  return `Uploaded ${date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })}`;
}
function getFileExtension(fileName) {
  const parts = String(fileName || "").split(".");
  return parts.length > 1
    ? parts.pop().slice(0, 4).toUpperCase()
    : "FILE";
}
function UnsortedFiles({
  unsortedFiles = [],
  jobs = [],
  refreshUnsortedFiles,
}) {
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [reviewFile, setReviewFile] = useState(null);
  const [previewFullscreen, setPreviewFullscreen] = useState(false);
  const [supplier, setSupplier] = useState("");
  const [addingNewSupplier, setAddingNewSupplier] = useState(false);
  const [purchaseDate, setPurchaseDate] = useState("");
  const [links, setLinks] = useState([]);
  const [vatTreatment, setVatTreatment] = useState("unreviewed");
  const [customVatAmount, setCustomVatAmount] = useState("");
  const [supplierSuggestions, setSupplierSuggestions] = useState([]);
  const [allUploadedFileNames, setAllUploadedFileNames] = useState([]);
  const [allLoggedFiles, setAllLoggedFiles] = useState([]);
  const [ignoredFiles, setIgnoredFiles] = useState([]);
  const [duplicateCandidate, setDuplicateCandidate] = useState(null);
  const [pendingSortedPayload, setPendingSortedPayload] = useState(null);
  useEffect(() => {
    refreshAllFileData();
  }, []);

  useEffect(() => {
    if (!previewFullscreen) return undefined;

    function closeFullscreenPreview(event) {
      if (event.key === "Escape") {
        setPreviewFullscreen(false);
      }
    }

    document.body.classList.add("unsortedPreviewOpen");
    window.addEventListener("keydown", closeFullscreenPreview);

    return () => {
      document.body.classList.remove("unsortedPreviewOpen");
      window.removeEventListener("keydown", closeFullscreenPreview);
    };
  }, [previewFullscreen]);

  async function refreshAllFileData() {
    try {
      const filesRes = await fetch(`${API_BASE}/api/files`);

      if (!filesRes.ok) {
        throw new Error("Files could not be loaded");
      }

      const files = await filesRes.json();
      const safeFiles = Array.isArray(files) ? files : [];
      const ignoredRes = await fetch(`${API_BASE}/api/files/ignored`);

      if (!ignoredRes.ok) {
        throw new Error("Ignored files could not be loaded");
      }

      const ignoredData = await ignoredRes.json();
      const safeIgnoredFiles = Array.isArray(ignoredData) ? ignoredData : [];
      const suppliers = [
        ...new Set(
          safeFiles.map((file) => file.supplier?.trim()).filter(Boolean),
        ),
      ].sort();
      const fileNames = safeFiles
        .map((file) => file.fileName || file.name)
        .filter(Boolean);
      setSupplierSuggestions(suppliers);
      setAllUploadedFileNames(fileNames);
      setAllLoggedFiles(safeFiles);
      setIgnoredFiles(safeIgnoredFiles);
    } catch (err) {
      console.error("Failed to fetch file data:", err);
    }
  }
  function getFileUrl(fileName) {
    return `${API_BASE}/api/files/unsorted/${encodeURIComponent(fileName)}`;
  }
  function getLoggedFileUrl(file) {
    if (!file?.url) return "";
    return `${API_BASE}${file.url}`;
  }
  function getLoggedFileName(file) {
    return file?.fileName || file?.name || "Unnamed file";
  }
  function getLinkTotal(fileLinks) {
    return (Array.isArray(fileLinks) ? fileLinks : []).reduce((sum, link) => {
      return sum + Number(link.cost || 0);
    }, 0);
  }
  function moneyMatches(a, b) {
    return Number(a || 0).toFixed(2) === Number(b || 0).toFixed(2);
  }
  function fileAlreadyExists(fileName) {
    const lowerName = fileName.toLowerCase();
    const unsortedNames = unsortedFiles.map((file) => file.name?.toLowerCase());
    const uploadedNames = allUploadedFileNames.map((name) =>
      name?.toLowerCase(),
    );
    const ignoredNames = ignoredFiles.map((file) =>
      file.fileName?.toLowerCase(),
    );
    return (
      unsortedNames.includes(lowerName) ||
      uploadedNames.includes(lowerName) ||
      ignoredNames.includes(lowerName)
    );
  }
  function getDuplicateLabel(fileName) {
    const lowerName = fileName.toLowerCase();
    const ignoredMatch = ignoredFiles.find(
      (file) => file.fileName?.toLowerCase() === lowerName,
    );
    if (ignoredMatch) {
      return "Previously deleted/blacklisted — will be skipped";
    }
    return "Already uploaded — will be skipped";
  }
  function findPossibleDuplicate(preparedLinks) {
    const newTotal = getLinkTotal(preparedLinks);
    const newDate = purchaseDate || null;
    const newSupplier = supplier.trim().toLowerCase();
    if (!newDate || !newTotal) return null;
    return allLoggedFiles.find((file) => {
      const existingTotal = getLinkTotal(file.links);
      const existingDate = file.purchaseDate || null;
      const existingSupplier = (file.supplier || "").trim().toLowerCase();
      const sameDate = existingDate === newDate;
      const sameAmount = moneyMatches(existingTotal, newTotal);
      const sameSupplier =
        newSupplier && existingSupplier && existingSupplier === newSupplier;
      return sameDate && sameAmount && (sameSupplier || !newSupplier);
    });
  }
  function resetReviewState() {
    setReviewFile(null);
    setPreviewFullscreen(false);
    setSupplier("");
    setAddingNewSupplier(false);
    setPurchaseDate("");
    setLinks([]);
    setVatTreatment("unreviewed");
    setCustomVatAmount("");
    setDuplicateCandidate(null);
    setPendingSortedPayload(null);
  }
  function handleFileSelect(e) {
    const files = Array.from(e.target.files);
    const preparedFiles = files.map((file) => ({
      file,
      name: file.name,
      size: file.size,
      alreadyExists: fileAlreadyExists(file.name),
      duplicateLabel: getDuplicateLabel(file.name),
    }));
    setSelectedFiles(preparedFiles);
    e.target.value = "";
  }
  async function uploadFiles() {
    const filesToUpload = selectedFiles.filter((item) => !item.alreadyExists);
    const skippedFiles = selectedFiles.filter((item) => item.alreadyExists);
    if (filesToUpload.length === 0) {
      alert("All selected files are already uploaded or blacklisted.");
      return;
    }
    const formData = new FormData();
    filesToUpload.forEach((item) => {
      formData.append("files", item.file);
    });
    try {
      const res = await fetch(`${API_BASE}/api/files/upload`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error("Upload failed");
      await refreshUnsortedFiles();
      await refreshAllFileData();
      setSelectedFiles([]);
      if (skippedFiles.length > 0) {
        alert(
          `${filesToUpload.length} file(s) uploaded. ${skippedFiles.length} file(s) skipped because they were already uploaded or blacklisted.`,
        );
      }
    } catch (err) {
      console.error("Upload failed:", err);
      alert("Upload failed.");
    }
  }
  async function deleteUnsortedFile(file) {
    const confirmed = window.confirm(
      `Delete "${file.name}"?\n\nThis removes it from unsorted files only. It can still be uploaded again later.`,
    );
    if (!confirmed) return;
    await deleteUnsortedFileWithoutConfirm(file);
  }
  async function deleteUnsortedFileWithoutConfirm(file) {
    try {
      const res = await fetch(
        `${API_BASE}/api/files/unsorted/${encodeURIComponent(file.name)}`,
        {
          method: "DELETE",
        },
      );
      if (!res.ok) throw new Error("Failed to delete unsorted file");
      await refreshUnsortedFiles();
      await refreshAllFileData();
      if (reviewFile?.name === file.name) {
        resetReviewState();
      }
    } catch (err) {
      console.error("Failed to delete unsorted file:", err);
      alert("Could not delete this file.");
    }
  }
  async function deleteAndBlacklistUnsortedFile(file) {
    const confirmed = window.confirm(
      `Delete and blacklist "${file.name}"?\n\nThis deletes it and remembers it, so it will be skipped if uploaded again.`,
    );
    if (!confirmed) return;
    try {
      const res = await fetch(`${API_BASE}/api/files/ignore-and-delete`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fileName: file.name,
          reason: "manually-blacklisted",
          duplicateOfFileId: null,
          duplicateOfFileName: "",
          supplier: "",
          purchaseDate: null,
          total: null,
          ignoredAt: new Date().toISOString(),
        }),
      });
      if (!res.ok) throw new Error("Failed to delete and blacklist file");
      await refreshUnsortedFiles();
      await refreshAllFileData();
      if (reviewFile?.name === file.name) {
        resetReviewState();
      }
    } catch (err) {
      console.error("Failed to delete and blacklist file:", err);
      alert("Could not delete and blacklist this file.");
    }
  }
  function createBlankLink() {
    return {
      targetValue: "",
      category: "",
      tag: "",
      cost: "",
      note: "",
    };
  }
  function startReview(file) {
    resetReviewState();
    setReviewFile(file);
    setLinks([createBlankLink()]);
  }
  function addLink() {
    setLinks((previousLinks) => [...previousLinks, createBlankLink()]);
  }
  function updateLink(index, field, value) {
    setLinks((previousLinks) =>
      previousLinks.map((link, linkIndex) => {
        if (linkIndex !== index) return link;

        const updatedLink = { ...link, [field]: value };

        if (
          field === "category" &&
          !costApplicableCategories.includes(value)
        ) {
          updatedLink.cost = "";
        }

        return updatedLink;
      }),
    );
  }
  function removeLink(index) {
    setLinks((prev) => prev.filter((_, i) => i !== index));
  }
  function parseTarget(targetValue) {
    const [targetType, targetId] = targetValue.split(":");
    if (targetType === "job") {
      const foundJob = jobs.find((job) => String(job.id) === String(targetId));
      return {
        targetType: "job",
        targetId,
        targetName: foundJob?.name || foundJob?.address || `Job ${targetId}`,
      };
    }
    if (targetType === "general") {
      return {
        targetType: "general",
        targetId: "no-job",
        targetName: "No Job Link",
      };
    }
    return null;
  }
  function buildSortedPayload() {
    const preparedLinks = links
      .filter((link) => link.targetValue && link.category && link.tag)
      .map((link) => {
        const target = parseTarget(link.targetValue);
        const parsedCost =
          link.cost === "" || link.cost === null || link.cost === undefined
            ? null
            : Number(link.cost);
        return {
          ...target,
          category: link.category,
          tag: link.tag,
          cost: parsedCost,
          note: link.note || "",
        };
      });
    const referenceOnly =
      preparedLinks.length > 0 &&
      preparedLinks.every(
        (link) => !costApplicableCategories.includes(link.category),
      );
    const gross = getLinkTotal(preparedLinks);
    const vat = referenceOnly
      ? calculateVatRecord(0, "no-vat")
      : calculateVatRecord(gross, vatTreatment, customVatAmount);
    return {
      fileName: reviewFile.name,
      supplier: referenceOnly ? "" : supplier.trim(),
      purchaseDate: referenceOnly ? null : purchaseDate || null,
      links: preparedLinks,
      vat,
      uploadedAt: reviewFile.uploadedAt || null,
      dateSorted: new Date().toISOString(),
    };
  }
  async function actuallySaveSortedFile(payload) {
    const res = await fetch(`${API_BASE}/api/files/assign`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("Failed to save sorted file");
    await refreshUnsortedFiles();
    await refreshAllFileData();
    resetReviewState();
  }
  async function saveSortedFile() {
    if (!reviewFile) return;
    const payload = buildSortedPayload();
    if (payload.links.length === 0) {
      alert("Please add at least one complete link, file type and tag.");
      return;
    }
    const invalidCost = payload.links.some(
      (link) => link.cost !== null && Number.isNaN(link.cost),
    );
    if (invalidCost) {
      alert("Please enter a valid cost.");
      return;
    }
    const gross = getLinkTotal(payload.links);
    if (gross > 0 && !payload.vat.reviewed) {
      alert("Please choose the VAT treatment for this cost.");
      return;
    }
    const containsCostRecord = payload.links.some((link) =>
      costApplicableCategories.includes(link.category),
    );
    if (
      containsCostRecord &&
      vatTreatment === "custom" &&
      (customVatAmount === "" ||
        Number.isNaN(Number(customVatAmount)) ||
        Number(customVatAmount) < 0 ||
        Number(customVatAmount) > gross)
    ) {
      alert("Please enter the VAT amount shown on the document.");
      return;
    }
    const possibleDuplicate = findPossibleDuplicate(payload.links);
    if (possibleDuplicate) {
      setDuplicateCandidate(possibleDuplicate);
      setPendingSortedPayload(payload);
      return;
    }
    try {
      await actuallySaveSortedFile(payload);
    } catch (err) {
      console.error("Failed to save sorted file:", err);
      alert("Could not save sorted file.");
    }
  }
  async function linkWithDuplicateFile() {
    if (!duplicateCandidate || !reviewFile) return;
    try {
      const res = await fetch(
        `${API_BASE}/api/files/${duplicateCandidate.id}/attach`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            unsortedFileName: reviewFile.name,
            attachedAt: new Date().toISOString(),
          }),
        },
      );
      if (!res.ok) throw new Error("Failed to attach file");
      await refreshUnsortedFiles();
      await refreshAllFileData();
      resetReviewState();
    } catch (err) {
      console.error("Failed to attach file:", err);
      alert("Could not link this file.");
    }
  }
  async function addAsSeparateFile() {
    if (!pendingSortedPayload) return;
    try {
      await actuallySaveSortedFile(pendingSortedPayload);
    } catch (err) {
      console.error("Failed to save sorted file:", err);
      alert("Could not save sorted file.");
    }
  }
  async function cancelAndDeleteDuplicate() {
    if (!reviewFile) return;
    const confirmed = window.confirm(
      `Cancel and delete "${reviewFile.name}"?\n\nThis will remember that this file has already been reviewed, so it should be skipped if uploaded again.`,
    );
    if (!confirmed) return;
    try {
      const res = await fetch(`${API_BASE}/api/files/ignore-and-delete`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fileName: reviewFile.name,
          reason: "duplicate-deleted",
          duplicateOfFileId: duplicateCandidate?.id || null,
          duplicateOfFileName: duplicateCandidate
            ? getLoggedFileName(duplicateCandidate)
            : "",
          supplier: supplier.trim(),
          purchaseDate: purchaseDate || null,
          total: getLinkTotal(pendingSortedPayload?.links || []),
          ignoredAt: new Date().toISOString(),
        }),
      });
      if (!res.ok) throw new Error("Failed to ignore and delete file");
      await refreshUnsortedFiles();
      await refreshAllFileData();
      resetReviewState();
    } catch (err) {
      console.error("Failed to ignore/delete file:", err);
      alert("Could not cancel and delete this file.");
    }
  }
  function closeDuplicateWarning() {
    setDuplicateCandidate(null);
    setPendingSortedPayload(null);
  }
  function renderFilePreviewByUrl(
    fileName,
    url,
    className = "review-preview-frame",
  ) {
    if (!url) {
      return <p className="soft-text">No preview URL available.</p>;
    }
    if (/\.(jpg|jpeg|png|gif|webp)$/i.test(fileName)) {
      return <img src={url} alt={fileName} className="review-preview-image" />;
    }
    if (/\.pdf$/i.test(fileName)) {
      return <iframe src={url} title={fileName} className={className} />;
    }
    return (
      <div className="review-preview-fallback">
        <p>No preview available</p>
        <a href={url} target="_blank" rel="noreferrer">
          Open file
        </a>
      </div>
    );
  }
  function renderPreview() {
    if (!reviewFile) return null;
    return renderFilePreviewByUrl(
      reviewFile.name,
      getFileUrl(reviewFile.name),
      "review-preview-frame",
    );
  }
  function renderDuplicateWarning() {
    if (!duplicateCandidate) return null;
    const duplicateName = getLoggedFileName(duplicateCandidate);
    const duplicateUrl = getLoggedFileUrl(duplicateCandidate);
    const duplicateTotal = getLinkTotal(duplicateCandidate.links);
    const currentTotal = getLinkTotal(pendingSortedPayload?.links || []);
    return (
      <div className="duplicate-modal-backdrop">
        <div className="duplicate-modal">
          <div className="duplicate-modal-header">
            <div>
              <h2>Possible Duplicate Found</h2>
              <p className="soft-text">
                This looks like a file you have already logged.
              </p>
            </div>
            <button
              type="button"
              className="sleekButton ghostButton"
              onClick={closeDuplicateWarning}
            >
              ×
            </button>
          </div>
          <div className="duplicate-summary-grid">
            <div className="duplicate-summary-card">
              <h3>Current Scan</h3>
              <p>{reviewFile?.name}</p>
              <strong>£{currentTotal.toFixed(2)}</strong>
              <p className="soft-text">{purchaseDate || "No date"}</p>
              <p className="soft-text">{supplier || "No supplier"}</p>
            </div>
            <div className="duplicate-summary-card">
              <h3>Existing File</h3>
              <p>{duplicateName}</p>
              <strong>£{duplicateTotal.toFixed(2)}</strong>
              <p className="soft-text">
                {duplicateCandidate.purchaseDate || "No date"}
              </p>
              <p className="soft-text">
                {duplicateCandidate.supplier || "No supplier"}
              </p>
            </div>
          </div>
          <div className="duplicate-preview-panel">
            <h3>Existing File Preview</h3>
            {renderFilePreviewByUrl(
              duplicateName,
              duplicateUrl,
              "duplicate-preview-frame",
            )}
          </div>
          <div className="duplicate-action-row">
            <button
              type="button"
              className="sleekButton successButton"
              onClick={linkWithDuplicateFile}
            >
              Link with this file
            </button>
            <button
              type="button"
              className="sleekButton primaryButton"
              onClick={addAsSeparateFile}
            >
              Add as separate file
            </button>
            <button
              type="button"
              className="sleekButton dangerButton"
              onClick={cancelAndDeleteDuplicate}
            >
              Cancel and blacklist
            </button>
          </div>
        </div>
      </div>
    );
  }
  if (reviewFile) {
    const reviewGross = getLinkTotal(links);
    const reviewIsReferenceOnly =
      links.length > 0 &&
      links.every(
        (link) =>
          link.category && !costApplicableCategories.includes(link.category),
      );
    const reviewVatPreview = calculateVatRecord(
      reviewGross,
      vatTreatment,
      customVatAmount,
    );
    return (
      <div className="unsorted-page unsorted-review-page">
        {renderDuplicateWarning()}

        <header className="review-page-header">
          <div className="review-heading-copy">
            <button
              type="button"
              className="sleekButton ghostButton review-back-button"
              onClick={resetReviewState}
            >
              ← Back to inbox
            </button>

            <h1>Review & Sort</h1>
            <p>
              {reviewIsReferenceOnly
                ? "Link this reference document to the right job."
                : "Check the document and record where this cost belongs."}
            </p>
          </div>

          <div className="unsorted-file-actions">
            <button
              type="button"
              className="sleekButton dangerButton"
              onClick={() => deleteUnsortedFile(reviewFile)}
            >
              Delete file
            </button>

            <button
              type="button"
              className="sleekButton dangerButton"
              onClick={() => deleteAndBlacklistUnsortedFile(reviewFile)}
            >
              Delete & blacklist
            </button>
          </div>
        </header>

        <div className="review-layout">
          <section
            className={`preview-panel ${
              previewFullscreen ? "preview-panel-fullscreen" : ""
            }`}
          >
            <div className="preview-panel-header">
              <div className="preview-file-heading">
                <span>Document preview</span>
                <h3 title={reviewFile.name}>{reviewFile.name}</h3>
              </div>
              <div className="preview-controls">
                <a
                  className="preview-control"
                  href={getFileUrl(reviewFile.name)}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open original ↗
                </a>
                <button
                  type="button"
                  className="preview-control preview-control-primary"
                  onClick={() => setPreviewFullscreen((current) => !current)}
                >
                  {previewFullscreen ? "Exit full screen" : "Full screen"}
                </button>
              </div>
            </div>
            <div className="preview-stage">{renderPreview()}</div>
          </section>
          <section className="sort-panel">
            <h3>File Details</h3>
            {reviewIsReferenceOnly ? (
              <div className="sort-reference-notice">
                <strong>Reference document</strong>
                <span>Supplier, purchase cost and VAT are not required.</span>
              </div>
            ) : (
              <>
                <div className="sort-field">
                  <label>Supplier</label>
                  <div className="supplier-picker-row">
                    <select
                      value={addingNewSupplier ? "" : supplier}
                      onChange={(e) => {
                        setSupplier(e.target.value);
                        setAddingNewSupplier(false);
                      }}
                    >
                      <option value="">Select supplier</option>
                      {supplierSuggestions.map((name) => (
                        <option key={name} value={name}>
                          {name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="sleekButton primaryButton supplier-add-button"
                      onClick={() => {
                        setSupplier("");
                        setAddingNewSupplier(true);
                      }}
                    >
                      + New
                    </button>
                  </div>
                  {addingNewSupplier && (
                    <input
                      autoFocus
                      value={supplier}
                      onChange={(e) => setSupplier(e.target.value)}
                      placeholder="Enter new supplier name"
                    />
                  )}
                </div>
                <div className="sort-field">
                  <label>Purchase Date</label>
                  <input
                    type="date"
                    value={purchaseDate}
                    onChange={(e) => setPurchaseDate(e.target.value)}
                  />
                </div>
              </>
            )}
            <div className="sort-section-header">
              <div>
                <h3>Allocation</h3>
                <p className="soft-text">
                  Choose where this document belongs and how its spend should
                  be recorded.
                </p>
              </div>
              <button
                type="button"
                className="sleekButton primaryButton"
                onClick={addLink}
              >
                + Add allocation
              </button>
            </div>
            {links.length === 0 && (
              <div className="emptyInvoices">No links added yet.</div>
            )}
            {links.map((link, index) => {
              const costApplies = costApplicableCategories.includes(
                link.category,
              );
              return (
                <div className="job-link-row sort-link-row" key={index}>
                  <div className="sort-field">
                    <label>Allocate To</label>
                    <select
                      value={link.targetValue}
                      onChange={(e) =>
                        updateLink(index, "targetValue", e.target.value)
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
                  <div className="sort-field">
                    <label>File Type</label>
                    <select
                      value={link.category}
                      onChange={(e) =>
                        updateLink(index, "category", e.target.value)
                      }
                    >
                      <option value="">Select file type</option>
                      {linkCategories.map((category) => (
                        <option key={category} value={category}>
                          {category}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="sort-field">
                    <label>Tag</label>
                    <select
                      value={link.tag}
                      onChange={(e) => updateLink(index, "tag", e.target.value)}
                    >
                      <option value="">Select tag</option>
                      {tagOptions.map((tag) => (
                        <option key={tag} value={tag}>
                          {tag}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div
                    className={`sort-field sort-cost-field ${
                      costApplies ? "" : "sort-field-disabled"
                    }`}
                  >
                    <label>Cost</label>
                    <div className="sort-money-input">
                      <span>£</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={costApplies ? link.cost : ""}
                        disabled={!costApplies}
                        onChange={(e) =>
                          updateLink(index, "cost", e.target.value)
                        }
                        placeholder={costApplies ? "0.00" : "Not required"}
                      />
                    </div>
                  </div>
                  <div className="sort-field">
                    <label>Note</label>
                    <input
                      value={link.note}
                      onChange={(e) =>
                        updateLink(index, "note", e.target.value)
                      }
                      placeholder="Optional note"
                    />
                  </div>
                  <button
                    type="button"
                    className="sleekButton dangerButton"
                    onClick={() => removeLink(index)}
                  >
                    Remove
                  </button>
                </div>
              );
            })}
            {reviewIsReferenceOnly ? (
              <section className="sort-reference-ready">
                <span aria-hidden="true">✓</span>
                <div>
                  <strong>Ready to file</strong>
                  <p>
                    This document will not affect spend, profit or the VAT pack.
                  </p>
                </div>
              </section>
            ) : (
              <section className="sort-vat-panel">
              <div className="sort-vat-header">
                <div>
                  <h3>VAT Treatment</h3>
                  <p className="soft-text">
                    Choose how VAT is shown on this document.
                  </p>
                </div>
                {reviewGross > 0 && !reviewVatPreview.reviewed && (
                  <span className="sort-vat-warning">Needs review</span>
                )}
              </div>
              <div className="sort-field">
                <label>VAT Treatment</label>
                <select
                  value={vatTreatment}
                  onChange={(e) => setVatTreatment(e.target.value)}
                >
                  {VAT_TREATMENTS.map((treatment) => (
                    <option key={treatment.value} value={treatment.value}>
                      {treatment.label}
                    </option>
                  ))}
                </select>
              </div>
              {vatTreatment === "custom" && (
                <div className="sort-field">
                  <label>VAT shown on document</label>
                  <input
                    type="number"
                    min="0"
                    max={reviewGross}
                    step="0.01"
                    value={customVatAmount}
                    onChange={(e) => setCustomVatAmount(e.target.value)}
                    placeholder="0.00"
                  />
                </div>
              )}
              <div className="sort-vat-summary">
                <div>
                  <span>Gross</span>
                  <strong>£{reviewGross.toFixed(2)}</strong>
                </div>
                <div>
                  <span>VAT</span>
                  <strong>
                    {reviewVatPreview.reviewed
                      ? `£${Number(reviewVatPreview.amount || 0).toFixed(2)}`
                      : "Not recorded"}
                  </strong>
                </div>
                <div>
                  <span>Net</span>
                  <strong>
                    {reviewVatPreview.reviewed
                      ? `£${Number(reviewVatPreview.net || 0).toFixed(2)}`
                      : "Not recorded"}
                  </strong>
                </div>
              </div>
              </section>
            )}
            <div className="sort-action-row">
              <button
                type="button"
                className="sleekButton successButton"
                onClick={saveSortedFile}
              >
                {reviewIsReferenceOnly
                  ? "Save reference document"
                  : "Save to Files & Costs"}
              </button>
            </div>
          </section>
        </div>
      </div>
    );
  }
  return (
    <div className="unsorted-page unsorted-inbox-page">
      <header className="inbox-page-heading">
        <div>
          <h1>File Inbox</h1>
          <p>
            Upload business documents, check for duplicates and allocate each
            file correctly.
          </p>
        </div>

        <span
          className={`inbox-count-badge ${
            unsortedFiles.length > 0 ? "has-files" : ""
          }`}
        >
          {unsortedFiles.length} {unsortedFiles.length === 1 ? "file" : "files"}{" "}
          awaiting review
        </span>
      </header>

      <section className="inbox-upload-strip">
        <div className="inbox-upload-copy">
          <span className="inbox-upload-mark" aria-hidden="true">
            ↑
          </span>

          <div>
            <h2>Upload documents</h2>
            <p>
              Add invoices, receipts, photos, certificates or other business
              files.
            </p>
          </div>
        </div>

        <label className="sleekButton primaryButton inbox-file-picker">
          + Select files
          <input type="file" multiple onChange={handleFileSelect} hidden />
        </label>
      </section>

      {selectedFiles.length > 0 && (
        <section className="upload-review-panel">
          <div className="upload-review-header">
            <div>
              <span>Ready to upload</span>
              <h2>
                {selectedFiles.length}{" "}
                {selectedFiles.length === 1
                  ? "file selected"
                  : "files selected"}
              </h2>
            </div>

            <button
              type="button"
              className="sleekButton ghostButton"
              onClick={() => setSelectedFiles([])}
            >
              Clear selection
            </button>
          </div>

          <div className="upload-selection-list">
            {selectedFiles.map((item) => (
              <div className="upload-selection-row" key={item.name}>
                <span
                  className={`inbox-file-type inbox-file-type-${getFileExtension(
                    item.name,
                  ).toLowerCase()}`}
                >
                  {getFileExtension(item.name)}
                </span>

                <div className="inbox-file-copy">
                  <strong title={item.name}>{item.name}</strong>
                  <span>{formatFileSize(item.size)}</span>
                </div>

                {item.alreadyExists ? (
                  <strong className="upload-status duplicate">
                    {item.duplicateLabel}
                  </strong>
                ) : (
                  <strong className="upload-status ready">Ready</strong>
                )}
              </div>
            ))}
          </div>

          <div className="upload-review-actions">
            <button
              type="button"
              className="sleekButton successButton upload-action-button"
              onClick={uploadFiles}
            >
              Upload new files
            </button>
          </div>
        </section>
      )}

      <section className="inbox-queue-panel">
        <div className="inbox-queue-header">
          <div>
            <span>Review queue</span>
            <h2>Files awaiting review</h2>
            <p>
              Open each document, record its details and move it into Files &
              Costs.
            </p>
          </div>

          <strong>
            {unsortedFiles.length}{" "}
            {unsortedFiles.length === 1 ? "record" : "records"}
          </strong>
        </div>

        {unsortedFiles.length === 0 ? (
          <div className="inbox-empty-state">
            <span aria-hidden="true">✓</span>
            <h3>Inbox clear</h3>
            <p>There are no documents waiting to be reviewed.</p>
          </div>
        ) : (
          <div className="inbox-file-list">
            {unsortedFiles.map((file) => {
              const extension = getFileExtension(file.name);

              return (
                <article className="inbox-file-row" key={file.name}>
                  <span
                    className={`inbox-file-type inbox-file-type-${extension.toLowerCase()}`}
                  >
                    {extension}
                  </span>

                  <div className="inbox-file-copy">
                    <strong title={file.name}>{file.name}</strong>
                    <span>
                      {formatFileSize(file.size)} ·{" "}
                      {formatInboxDate(file.uploadedAt)}
                    </span>
                  </div>

                  <div className="inbox-file-actions">
                    <button
                      type="button"
                      className="sleekButton primaryButton"
                      onClick={() => startReview(file)}
                    >
                      Review & sort
                    </button>

                    <button
                      type="button"
                      className="sleekButton dangerButton"
                      onClick={() => deleteUnsortedFile(file)}
                    >
                      Delete
                    </button>

                    <button
                      type="button"
                      className="sleekButton dangerButton"
                      onClick={() => deleteAndBlacklistUnsortedFile(file)}
                      title="Delete this file and prevent it being uploaded again"
                    >
                      Blacklist
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
export default UnsortedFiles;
