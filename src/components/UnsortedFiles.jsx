import { useState, useEffect } from "react";

const API_BASE = "http://192.168.0.22:3001";

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

function UnsortedFiles({
  unsortedFiles = [],
  jobs = [],
  refreshUnsortedFiles,
}) {
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [reviewFile, setReviewFile] = useState(null);

  const [supplier, setSupplier] = useState("");
  const [purchaseDate, setPurchaseDate] = useState("");
  const [links, setLinks] = useState([]);

  const [supplierSuggestions, setSupplierSuggestions] = useState([]);
  const [allUploadedFileNames, setAllUploadedFileNames] = useState([]);
  const [allLoggedFiles, setAllLoggedFiles] = useState([]);
  const [ignoredFiles, setIgnoredFiles] = useState([]);

  const [duplicateCandidate, setDuplicateCandidate] = useState(null);
  const [pendingSortedPayload, setPendingSortedPayload] = useState(null);

  useEffect(() => {
    refreshAllFileData();
  }, []);

  async function refreshAllFileData() {
    try {
      const filesRes = await fetch(`${API_BASE}/api/files`);
      const files = await filesRes.json();
      const safeFiles = Array.isArray(files) ? files : [];

      const ignoredRes = await fetch(`${API_BASE}/api/files/ignored`);
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
    setSupplier("");
    setPurchaseDate("");
    setLinks([]);
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

  function startReview(file) {
    resetReviewState();
    setReviewFile(file);
  }

  function addLink() {
    setLinks((prev) => [
      ...prev,
      {
        targetValue: "",
        category: "",
        tag: "",
        cost: "",
        note: "",
      },
    ]);
  }

  function updateLink(index, field, value) {
    setLinks((prev) =>
      prev.map((link, i) => (i === index ? { ...link, [field]: value } : link)),
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

    return {
      fileName: reviewFile.name,
      supplier: supplier.trim(),
      purchaseDate: purchaseDate || null,
      links: preparedLinks,
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

    if (fileName.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
      return <img src={url} alt={fileName} className="review-preview-image" />;
    }

    if (fileName.match(/\.pdf$/i)) {
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
    return (
      <div className="widget unsorted-page">
        {renderDuplicateWarning()}

        <div className="unsorted-topbar">
          <button
            className="sleekButton ghostButton"
            onClick={resetReviewState}
          >
            ← Back to unsorted
          </button>

          <div className="unsorted-file-actions">
            <button
              className="sleekButton dangerButton"
              onClick={() => deleteUnsortedFile(reviewFile)}
            >
              Delete File
            </button>

            <button
              className="sleekButton dangerButton"
              onClick={() => deleteAndBlacklistUnsortedFile(reviewFile)}
            >
              Delete & Blacklist
            </button>
          </div>
        </div>

        <h2>Review & Sort</h2>

        <div className="review-layout">
          <section className="preview-panel">
            <h3>{reviewFile.name}</h3>
            {renderPreview()}
          </section>

          <section className="sort-panel">
            <h3>File Details</h3>

            <div className="sort-field">
              <label>Supplier</label>
              <input
                list="supplier-suggestions"
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
                placeholder="e.g. Screwfix, Tesco, Travis Perkins"
              />

              <datalist id="supplier-suggestions">
                {supplierSuggestions.map((name) => (
                  <option key={name} value={name} />
                ))}
              </datalist>
            </div>

            <div className="sort-field">
              <label>Purchase Date</label>
              <input
                type="date"
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
              />
            </div>

            <div className="sort-section-header">
              <div>
                <h3>Links</h3>
                <p className="soft-text">
                  Link this file to a job or mark it as having no job link. Then
                  choose the file type and tag.
                </p>
              </div>

              <button className="sleekButton primaryButton" onClick={addLink}>
                + Add Link
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
                    <label>Link To</label>
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

                  {costApplies && (
                    <div className="sort-field">
                      <label>Cost</label>
                      <input
                        type="number"
                        step="0.01"
                        value={link.cost}
                        onChange={(e) =>
                          updateLink(index, "cost", e.target.value)
                        }
                        placeholder="Cost £"
                      />
                    </div>
                  )}

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
                    className="sleekButton dangerButton"
                    onClick={() => removeLink(index)}
                  >
                    Remove
                  </button>
                </div>
              );
            })}

            <div className="sort-action-row">
              <button
                className="sleekButton successButton"
                onClick={saveSortedFile}
              >
                Save Sorted File
              </button>
            </div>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="widget unsorted-page">
      <div className="unsorted-grid">
        <section className="unsorted-panel">
          <h2>Upload Files</h2>

          <label className="upload-button sleekUploadButton">
            Select Files
            <input
              type="file"
              multiple
              onChange={handleFileSelect}
              style={{ display: "none" }}
            />
          </label>

          {selectedFiles.length > 0 && (
            <div className="selected-files">
              <h3>{selectedFiles.length} file(s) selected</h3>

              {selectedFiles.map((item) => (
                <div className="file-row sleek-file-row" key={item.name}>
                  <span>{item.name}</span>

                  {item.alreadyExists ? (
                    <strong className="duplicate-warning">
                      {item.duplicateLabel}
                    </strong>
                  ) : (
                    <strong className="soft-text">Ready to upload</strong>
                  )}
                </div>
              ))}

              <button
                onClick={uploadFiles}
                className="sleekButton successButton upload-action-button"
              >
                Upload New Files
              </button>
            </div>
          )}
        </section>

        <section className="unsorted-panel">
          <h2>Unsorted Files</h2>

          {unsortedFiles.length === 0 ? (
            <p className="soft-text">No files</p>
          ) : (
            <div className="unsorted-list">
              {unsortedFiles.map((file) => (
                <div className="file-row sleek-file-row" key={file.name}>
                  <span>{file.name}</span>

                  <div className="unsorted-file-actions">
                    <button
                      className="sleekButton primaryButton"
                      onClick={() => startReview(file)}
                    >
                      Review & Sort
                    </button>

                    <button
                      className="sleekButton dangerButton"
                      onClick={() => deleteUnsortedFile(file)}
                    >
                      Delete
                    </button>

                    <button
                      className="sleekButton dangerButton"
                      onClick={() => deleteAndBlacklistUnsortedFile(file)}
                    >
                      Delete & Blacklist
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

export default UnsortedFiles;
