import { useEffect, useMemo, useState } from "react";
import "./Files.css";
import { getJobColour } from "./jobColour";

const API_BASE = "";
const PAGE_SIZE = 25;

const TAG_OPTIONS = [
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

const FILE_CATEGORIES = [
  "invoice",
  "receipt",
  "quote",
  "photo",
  "drawing",
  "certificate",
  "licence",
  "other",
];

const COST_APPLICABLE_CATEGORIES = new Set(["invoice", "receipt", "other"]);

function linkUsesCost(link) {
  return COST_APPLICABLE_CATEGORIES.has(
    String(link?.category || "").trim().toLowerCase(),
  );
}

function isReferenceFile(file) {
  const links = Array.isArray(file?.links) ? file.links : [];
  return links.length > 0 && links.every((link) => !linkUsesCost(link));
}

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

function money(value) {
  return `£${Number(value || 0).toLocaleString("en-GB", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(value) {
  if (!value) return "No date";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No date";

  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function dateInputValue(value) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return date.toISOString().slice(0, 10);
}

function getMonthValueFromDate(value) {
  if (!value) return "no-date";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "no-date";

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function getMonthLabel(value) {
  if (value === "no-date") return "No date";

  const [year, month] = value.split("-");
  return new Date(Number(year), Number(month) - 1, 1).toLocaleDateString(
    "en-GB",
    { month: "long", year: "numeric" },
  );
}

function isWithinPeriod(value, period, vatPeriods = []) {
  if (period === "all") return true;
  if (!value) return false;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;

  if (period.startsWith("month:")) {
    return getMonthValueFromDate(date) === period.replace("month:", "");
  }

  if (period === "current-vat" || period.startsWith("vat:")) {
    const vatPeriod = period === "current-vat"
      ? vatPeriods.find((item) => item.isCurrent)
      : vatPeriods.find((item) => item.id === period.replace("vat:", ""));
    if (!vatPeriod) return true;
    const inputDate = date.toISOString().slice(0, 10);
    return inputDate >= vatPeriod.start && inputDate <= vatPeriod.end;
  }

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  if (period === "current-month") {
    return (
      date.getFullYear() === currentYear && date.getMonth() === currentMonth
    );
  }

  if (period === "previous-month") {
    const previous = new Date(currentYear, currentMonth - 1, 1);
    return (
      date.getFullYear() === previous.getFullYear() &&
      date.getMonth() === previous.getMonth()
    );
  }

  if (period === "current-year") {
    return date.getFullYear() === currentYear;
  }

  return true;
}

function normaliseOldCategory(category) {
  const value = String(category || "")
    .trim()
    .toLowerCase();

  if (FILE_CATEGORIES.includes(value)) return value;
  if (["materials", "accounting", "insurance"].includes(value))
    return "invoice";
  if (["van", "ppe", "office / admin", "tools", "fuel"].includes(value)) {
    return "receipt";
  }

  return "other";
}

function normaliseOldBusinessTag(targetId, targetName) {
  const value = String(targetId || targetName || "").toLowerCase();

  if (value.includes("fuel")) return "Fuel";
  if (value.includes("ppe") || value.includes("workwear")) {
    return "PPE / Workwear";
  }
  if (value.includes("tool")) return "Tools";
  if (value.includes("van")) return "Van Maintenance";
  if (value.includes("office") || value.includes("admin")) {
    return "Office / Admin";
  }
  if (value.includes("advert")) return "Advertising";
  if (value.includes("labour") || value.includes("labor")) return "Labour";
  if (value.includes("waste")) return "Waste Removal";
  if (value.includes("material")) return "Materials";

  return "";
}

function blankLink() {
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

function vatTreatmentLabel(status) {
  return (
    VAT_TREATMENTS.find((item) => item.value === status)?.label ||
    "VAT reviewed"
  );
}

function Files({
  files: suppliedFiles = [],
  jobs = [],
  navigate,
  navData = {},
  refreshFiles,
}) {
  const [loggedFiles, setLoggedFiles] = useState(
    Array.isArray(suppliedFiles) ? suppliedFiles : [],
  );
  const [vatPeriods, setVatPeriods] = useState([]);
  const [unsortedCount, setUnsortedCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const [selectedPeriod, setSelectedPeriod] = useState(
    navData?.jobId ? "all" : navData?.period || "current-vat",
  );
  const [selectedSupplier, setSelectedSupplier] = useState("all");
  const [selectedTag, setSelectedTag] = useState(navData?.tag || "all");
  const [selectedJobId, setSelectedJobId] = useState(
    navData?.jobId ? String(navData.jobId) : "all",
  );
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [warningView, setWarningView] = useState("all");
  const [viewMode, setViewMode] = useState("list");
  const [sort, setSort] = useState({ key: "date", direction: "desc" });
  const [page, setPage] = useState(1);

  const [editingFileId, setEditingFileId] = useState(null);
  const [editFocus, setEditFocus] = useState("details");
  const [savingFile, setSavingFile] = useState(false);
  const [editMessage, setEditMessage] = useState("");
  const [editForm, setEditForm] = useState({
    supplier: "",
    purchaseDate: "",
    links: [],
    vatTreatment: "unreviewed",
    customVatAmount: "",
  });

  useEffect(() => {
    if (Array.isArray(suppliedFiles)) {
      setLoggedFiles(suppliedFiles);
    }
  }, [suppliedFiles]);

  useEffect(() => {
    fetchLoggedFiles();
    fetchUnsortedCount();
    fetch(`${API_BASE}/api/vat/periods`)
      .then((response) => {
        if (!response.ok) throw new Error("Could not load VAT periods.");
        return response.json();
      })
      .then((data) => setVatPeriods(Array.isArray(data.periods) ? data.periods : []))
      .catch((error) => console.error(error));
  }, []);

  useEffect(() => {
    if (navData?.jobId) {
      setSelectedJobId(String(navData.jobId));
      setSelectedPeriod("all");
      setSelectedSupplier("all");
      setSelectedTag("all");
      setSelectedCategory("all");
      setSelectedStatus("all");
      setSearchTerm("");
      setWarningView("all");
      return;
    }

    if (navData?.tag) {
      setSelectedTag(navData.tag);
      setSelectedJobId("all");
      setSelectedCategory("all");
      setSelectedSupplier("all");
      setSearchTerm("");
      setWarningView("all");
    }
  }, [navData?.jobId, navData?.tag]);

  useEffect(() => {
    setPage(1);
  }, [
    selectedPeriod,
    selectedSupplier,
    selectedTag,
    selectedJobId,
    selectedCategory,
    selectedStatus,
    searchTerm,
    warningView,
    sort.key,
    sort.direction,
    viewMode,
  ]);

  useEffect(() => {
    function closeOnEscape(event) {
      if (event.key === "Escape") cancelEditingFile();
    }

    if (editingFileId !== null) {
      window.addEventListener("keydown", closeOnEscape);
      document.body.classList.add("filesModalOpen");
    }

    return () => {
      window.removeEventListener("keydown", closeOnEscape);
      document.body.classList.remove("filesModalOpen");
    };
  }, [editingFileId]);

  async function fetchLoggedFiles() {
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE}/api/files`);
      if (!response.ok) throw new Error("Files could not be loaded");

      const data = await response.json();
      setLoggedFiles(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to fetch logged files:", error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchUnsortedCount() {
    try {
      const response = await fetch(`${API_BASE}/api/files/unsorted`);
      if (!response.ok) throw new Error("Inbox could not be loaded");

      const data = await response.json();
      setUnsortedCount(Array.isArray(data) ? data.length : 0);
    } catch (error) {
      console.error("Failed to load unsorted file count:", error);
      setUnsortedCount(0);
    }
  }

  function getFileName(file) {
    return file.fileName || file.name || "Unnamed file";
  }

  function getFileDate(file) {
    return file.purchaseDate || file.dateSorted || file.uploadedAt || "";
  }

  function getFileUrl(file) {
    return file.url ? `${API_BASE}${file.url}` : "";
  }

  function getJobName(jobId) {
    const job = jobs.find((item) => String(item.id) === String(jobId));
    return job?.name || job?.address || `Job ${jobId}`;
  }

  function getTargetName(link) {
    if (link.targetType === "job") {
      return link.targetName || getJobName(link.targetId);
    }

    return "No Job Link";
  }

  function getFileTotal(file) {
    return (file.links || []).reduce(
      (sum, link) => sum + Number(link.cost || 0),
      0,
    );
  }

  function getFileVat(file) {
    return file.vat?.reviewed ? Number(file.vat.amount || 0) : 0;
  }

  function getFileNet(file) {
    const gross = getFileTotal(file);

    if (!file.vat?.reviewed) return null;
    if (file.vat.net !== null && file.vat.net !== undefined) {
      return Number(file.vat.net || 0);
    }

    return gross - getFileVat(file);
  }

  function getFileJobNames(file) {
    const names = (file.links || [])
      .filter((link) => link.targetType === "job")
      .map((link) => getTargetName(link));

    return [...new Set(names)];
  }

  function getFileTags(file) {
    return [
      ...new Set((file.links || []).map((link) => link.tag).filter(Boolean)),
    ];
  }

  function getFileCategories(file) {
    return [
      ...new Set(
        (file.links || []).map((link) => link.category).filter(Boolean),
      ),
    ];
  }

  function normaliseOldLink(link) {
    if (link.targetType === "business") {
      return {
        targetType: "general",
        targetId: "no-job",
        targetName: "No Job Link",
        category: normaliseOldCategory(link.category),
        tag:
          link.tag || normaliseOldBusinessTag(link.targetId, link.targetName),
        cost: link.cost ?? "",
        note: link.note || "",
      };
    }

    return {
      targetType: link.targetType === "job" ? "job" : "general",
      targetId: link.targetType === "job" ? String(link.targetId) : "no-job",
      targetName:
        link.targetType === "job"
          ? link.targetName || getJobName(link.targetId)
          : "No Job Link",
      category: normaliseOldCategory(link.category),
      tag: link.tag || "",
      cost: link.cost ?? "",
      note: link.note || "",
    };
  }

  function getVatTreatment(file) {
    if (!file.vat?.reviewed) return "unreviewed";

    const status = file.vat.status;
    return VAT_TREATMENTS.some((item) => item.value === status)
      ? status
      : Number(file.vat.amount || 0) > 0
        ? "custom"
        : "no-vat";
  }

  function startEditingFile(file, focus = "details") {
    setEditingFileId(file.id);
    setEditFocus(focus);
    setEditMessage("");
    setEditForm({
      supplier: file.supplier || "",
      purchaseDate: dateInputValue(file.purchaseDate),
      links:
        Array.isArray(file.links) && file.links.length
          ? file.links.map(normaliseOldLink)
          : [blankLink()],
      vatTreatment: getVatTreatment(file),
      customVatAmount: file.vat?.amount ?? "",
    });
  }

  function cancelEditingFile() {
    setEditingFileId(null);
    setEditFocus("details");
    setEditMessage("");
    setEditForm({
      supplier: "",
      purchaseDate: "",
      links: [],
      vatTreatment: "unreviewed",
      customVatAmount: "",
    });
  }

  function updateEditLink(index, field, value) {
    setEditForm((current) => {
      const updatedLinks = [...current.links];
      const nextLink = { ...updatedLinks[index], [field]: value };

      if (field === "targetValue") {
        const [targetType, targetId] = value.split(":");

        if (targetType === "job") {
          nextLink.targetType = "job";
          nextLink.targetId = targetId;
          nextLink.targetName = getJobName(targetId);
        } else {
          nextLink.targetType = "general";
          nextLink.targetId = "no-job";
          nextLink.targetName = "No Job Link";
        }
      }

      if (field === "category" && !linkUsesCost(nextLink)) {
        nextLink.cost = "";
      }

      updatedLinks[index] = nextLink;
      return { ...current, links: updatedLinks };
    });
  }

  function addEditLink() {
    setEditForm((current) => ({
      ...current,
      links: [...current.links, blankLink()],
    }));
  }

  function removeEditLink(index) {
    setEditForm((current) => ({
      ...current,
      links: current.links.filter((_, linkIndex) => linkIndex !== index),
    }));
  }

  function getTargetValue(link) {
    return link.targetType === "job"
      ? `job:${link.targetId}`
      : "general:no-job";
  }

  function cleanEditLinks() {
    return editForm.links.map((link) => ({
      targetType: link.targetType === "job" ? "job" : "general",
      targetId: link.targetType === "job" ? String(link.targetId) : "no-job",
      targetName:
        link.targetType === "job" ? getJobName(link.targetId) : "No Job Link",
      category: link.category || "other",
      tag: link.tag || "",
      cost: link.cost === "" ? null : roundMoney(Number(link.cost)),
      note: link.note || "",
    }));
  }

  function validateEditLinks(links) {
    if (!links.length) return "Add at least one assignment.";

    const incomplete = links.some(
      (link) =>
        !link.targetType ||
        !link.targetId ||
        !link.category ||
        !link.tag ||
        (linkUsesCost(link) &&
          (link.cost === null || Number.isNaN(Number(link.cost)))),
    );

    return incomplete
      ? "Every assignment needs a destination, file type and tag. Invoices, receipts and cost records also need a cost."
      : "";
  }

  async function saveFileEdit(file) {
    if (savingFile) return;

    const links = cleanEditLinks();
    const validationMessage = validateEditLinks(links);

    if (validationMessage) {
      setEditMessage(validationMessage);
      return;
    }

    const referenceOnly = links.every((link) => !linkUsesCost(link));
    const gross = links.reduce((sum, link) => sum + Number(link.cost || 0), 0);
    const vat = referenceOnly
      ? calculateVatRecord(0, "no-vat")
      : calculateVatRecord(
          gross,
          editForm.vatTreatment,
          editForm.customVatAmount,
        );

    const updatedFile = {
      ...file,
      supplier: referenceOnly ? "" : editForm.supplier.trim(),
      purchaseDate: referenceOnly ? null : editForm.purchaseDate || null,
      links,
      vat,
    };

    setSavingFile(true);
    setEditMessage("Saving file...");

    try {
      const response = await fetch(`${API_BASE}/api/files/${file.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedFile),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "File update failed");
      }

      const data = await response.json();
      const savedFile = data.file || updatedFile;

      setLoggedFiles((current) =>
        current.map((item) =>
          String(item.id) === String(file.id) ? savedFile : item,
        ),
      );

      if (typeof refreshFiles === "function") {
        Promise.resolve(refreshFiles()).catch((error) => {
          console.error("File saved, but the dashboard refresh failed:", error);
        });
      }

      cancelEditingFile();
    } catch (error) {
      console.error("Failed to update file:", error);
      setEditMessage(error.message || "Could not update this file.");
    } finally {
      setSavingFile(false);
    }
  }

  async function deleteFile(file) {
    const confirmed = window.confirm(
      `Delete "${getFileName(file)}"?\n\nThis removes the record and stored file.`,
    );

    if (!confirmed) return;

    try {
      const response = await fetch(`${API_BASE}/api/files/${file.id}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Delete failed");

      setLoggedFiles((current) =>
        current.filter((item) => String(item.id) !== String(file.id)),
      );
      cancelEditingFile();

      if (typeof refreshFiles === "function") {
        Promise.resolve(refreshFiles()).catch((error) => {
          console.error(
            "File deleted, but the dashboard refresh failed:",
            error,
          );
        });
      }
    } catch (error) {
      console.error("Failed to delete file:", error);
      setEditMessage("Could not delete this file.");
    }
  }

  function fileHasMissingCost(file) {
    const links = Array.isArray(file.links) ? file.links : [];
    return (
      links.length === 0 ||
      links.some(
        (link) =>
          linkUsesCost(link) &&
          (link.cost === null || link.cost === undefined || link.cost === ""),
      )
    );
  }

  function fileHasMissingVat(file) {
    return getFileTotal(file) > 0 && file.vat?.reviewed !== true;
  }

  function fileHasNoJob(file) {
    const links = Array.isArray(file.links) ? file.links : [];
    return !links.some((link) => link.targetType === "job");
  }

  function fileHasMissingDetails(file) {
    const links = Array.isArray(file.links) ? file.links : [];
    const needsPurchaseDetails = links.some(linkUsesCost);
    return (
      (needsPurchaseDetails && !file.supplier?.trim()) ||
      (needsPurchaseDetails && !getFileDate(file)) ||
      links.length === 0 ||
      links.some((link) => !link.tag || !link.category)
    );
  }

  const possibleDuplicateIds = useMemo(() => {
    const groups = new Map();

    loggedFiles.forEach((file) => {
      const supplier = String(file.supplier || "")
        .trim()
        .toLowerCase();
      const date =
        getMonthValueFromDate(getFileDate(file)) === "no-date"
          ? ""
          : String(getFileDate(file)).slice(0, 10);
      const gross = roundMoney(getFileTotal(file));

      if (!supplier || !date || gross <= 0) return;

      const key = `${supplier}|${date}|${gross.toFixed(2)}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(String(file.id));
    });

    const ids = new Set();
    groups.forEach((group) => {
      if (group.length > 1) group.forEach((id) => ids.add(id));
    });
    return ids;
  }, [loggedFiles]);

  function getFileStatus(file) {
    if (fileHasMissingCost(file)) {
      return { key: "missing-cost", label: "Missing cost", tone: "danger" };
    }
    if (fileHasMissingVat(file)) {
      return { key: "missing-vat", label: "Fix VAT", tone: "warning" };
    }
    if (fileHasMissingDetails(file)) {
      return { key: "missing-details", label: "Review", tone: "warning" };
    }
    if (possibleDuplicateIds.has(String(file.id))) {
      return { key: "duplicate", label: "Possible duplicate", tone: "warning" };
    }
    if (fileHasNoJob(file)) {
      return { key: "no-job", label: "No job link", tone: "neutral" };
    }
    if (isReferenceFile(file)) {
      return { key: "reference", label: "Reference", tone: "reference" };
    }
    if (getFileVat(file) === 0) {
      return { key: "no-vat", label: "No VAT", tone: "neutral" };
    }

    return { key: "complete", label: "Complete", tone: "success" };
  }

  const contextJob = useMemo(
    () => jobs.find((job) => String(job.id) === String(navData?.jobId)),
    [jobs, navData?.jobId],
  );

  const supplierOptions = useMemo(
    () =>
      [
        ...new Set(loggedFiles.map((file) => file.supplier).filter(Boolean)),
      ].sort((a, b) => a.localeCompare(b)),
    [loggedFiles],
  );

  const jobOptions = useMemo(() => {
    const linkedIds = new Set();

    loggedFiles.forEach((file) => {
      (file.links || []).forEach((link) => {
        if (link.targetType === "job" && link.targetId) {
          linkedIds.add(String(link.targetId));
        }
      });
    });

    return jobs
      .filter((job) => linkedIds.has(String(job.id)))
      .map((job) => ({
        value: String(job.id),
        label: job.name || job.address || `Job ${job.id}`,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [loggedFiles, jobs]);

  const categoryOptions = useMemo(() => {
    const values = new Set();
    loggedFiles.forEach((file) => {
      (file.links || []).forEach((link) => {
        if (link.category) values.add(link.category);
      });
    });
    return [...values].sort();
  }, [loggedFiles]);

  const monthOptions = useMemo(() => {
    const values = new Set();
    loggedFiles.forEach((file) => {
      const month = getMonthValueFromDate(getFileDate(file));
      if (month !== "no-date") values.add(month);
    });

    return [...values]
      .sort((a, b) => b.localeCompare(a))
      .map((value) => ({ value, label: getMonthLabel(value) }));
  }, [loggedFiles]);

  function fileMatchesSearch(file) {
    if (!searchTerm.trim()) return true;

    const search = searchTerm.trim().toLowerCase();
    const haystack = [
      getFileName(file),
      file.supplier,
      getFileDate(file),
      ...(file.links || []).flatMap((link) => [
        getTargetName(link),
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

  function fileMatchesRegularFilters(file) {
    const links = Array.isArray(file.links) ? file.links : [];
    const status = getFileStatus(file);

    const matchesSupplier =
      selectedSupplier === "all" || file.supplier === selectedSupplier;
    const matchesTag =
      selectedTag === "all" || links.some((link) => link.tag === selectedTag);
    const matchesJob =
      selectedJobId === "all" ||
      (selectedJobId === "no-job"
        ? fileHasNoJob(file)
        : links.some(
            (link) =>
              link.targetType === "job" &&
              String(link.targetId) === String(selectedJobId),
          ));
    const matchesCategory =
      selectedCategory === "all" ||
      links.some((link) => link.category === selectedCategory);
    const matchesStatus =
      selectedStatus === "all" || status.key === selectedStatus;

    return (
      isWithinPeriod(getFileDate(file), selectedPeriod, vatPeriods) &&
      matchesSupplier &&
      matchesTag &&
      matchesJob &&
      matchesCategory &&
      matchesStatus &&
      fileMatchesSearch(file)
    );
  }

  const baseFilteredFiles = loggedFiles.filter(fileMatchesRegularFilters);

  const warningCounts = useMemo(
    () => ({
      missingCost: baseFilteredFiles.filter(fileHasMissingCost).length,
      missingVat: baseFilteredFiles.filter(fileHasMissingVat).length,
      noJob: baseFilteredFiles.filter(fileHasNoJob).length,
      missingDetails: baseFilteredFiles.filter(fileHasMissingDetails).length,
      duplicates: baseFilteredFiles.filter((file) =>
        possibleDuplicateIds.has(String(file.id)),
      ).length,
    }),
    [baseFilteredFiles, possibleDuplicateIds],
  );

  function fileMatchesWarning(file) {
    if (warningView === "all") return true;
    if (warningView === "missing-cost") return fileHasMissingCost(file);
    if (warningView === "missing-vat") return fileHasMissingVat(file);
    if (warningView === "no-job") return fileHasNoJob(file);
    if (warningView === "missing-details") return fileHasMissingDetails(file);
    if (warningView === "duplicate") {
      return possibleDuplicateIds.has(String(file.id));
    }
    return true;
  }

  const filteredFiles = baseFilteredFiles.filter(fileMatchesWarning);

  function sortValue(file, key) {
    if (key === "date") return new Date(getFileDate(file) || 0).getTime();
    if (key === "name") return getFileName(file).toLowerCase();
    if (key === "supplier") return String(file.supplier || "").toLowerCase();
    if (key === "job") return getFileJobNames(file).join(" ").toLowerCase();
    if (key === "category") return getFileTags(file).join(" ").toLowerCase();
    if (key === "gross") return getFileTotal(file);
    if (key === "vat") return getFileVat(file);
    if (key === "net") return getFileNet(file) ?? -1;
    if (key === "status") return getFileStatus(file).label.toLowerCase();
    return "";
  }

  const sortedFiles = useMemo(() => {
    const direction = sort.direction === "asc" ? 1 : -1;

    return [...filteredFiles].sort((a, b) => {
      const aValue = sortValue(a, sort.key);
      const bValue = sortValue(b, sort.key);

      let result = 0;
      if (typeof aValue === "number" && typeof bValue === "number") {
        result = aValue - bValue;
      } else {
        result = String(aValue).localeCompare(String(bValue), "en-GB", {
          numeric: true,
          sensitivity: "base",
        });
      }

      if (result === 0) {
        result = getFileName(a).localeCompare(getFileName(b));
      }

      return result * direction;
    });
  }, [filteredFiles, sort]);

  const filteredGross = filteredFiles.reduce(
    (sum, file) => sum + getFileTotal(file),
    0,
  );
  const filteredVat = filteredFiles.reduce(
    (sum, file) => sum + getFileVat(file),
    0,
  );
  const filteredNet = filteredFiles.reduce(
    (sum, file) => sum + Number(getFileNet(file) ?? 0),
    0,
  );
  const reviewedCostFiles = filteredFiles.filter(
    (file) => getFileTotal(file) > 0 && file.vat?.reviewed,
  ).length;
  const costFileCount = filteredFiles.filter(
    (file) => getFileTotal(file) > 0,
  ).length;

  const pageCount = Math.max(Math.ceil(sortedFiles.length / PAGE_SIZE), 1);
  const safePage = Math.min(page, pageCount);
  const visibleFiles = sortedFiles.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE,
  );

  const tagBreakdown = TAG_OPTIONS.map((tag) => {
    const total = filteredFiles.reduce((fileSum, file) => {
      const tagTotal = (file.links || [])
        .filter((link) => link.tag === tag)
        .reduce((sum, link) => sum + Number(link.cost || 0), 0);
      return fileSum + tagTotal;
    }, 0);

    return { tag, total };
  })
    .filter((item) => item.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, 6);

  const maxTagTotal = Math.max(...tagBreakdown.map((item) => item.total), 1);

  const groupedByJob = useMemo(() => {
    const groups = {};

    sortedFiles.forEach((file) => {
      const jobLinks = (file.links || []).filter(
        (link) => link.targetType === "job",
      );

      if (!jobLinks.length) {
        if (!groups["no-job"]) {
          groups["no-job"] = { title: "No Job Link", files: [], total: 0, colour: "#687082" };
        }
        groups["no-job"].files.push(file);
        groups["no-job"].total += getFileTotal(file);
        return;
      }

      jobLinks.forEach((link) => {
        const key = String(link.targetId);
        if (!groups[key]) {
          const linkedJob = jobs.find((job) => String(job.id) === key);
          groups[key] = {
            title: getTargetName(link),
            files: [],
            total: 0,
            colour: linkedJob ? getJobColour(linkedJob) : "#687082",
          };
        }
        groups[key].files.push(file);
        groups[key].total += Number(link.cost || 0);
      });
    });

    return Object.entries(groups).sort(([, a], [, b]) =>
      a.title.localeCompare(b.title),
    );
  }, [sortedFiles, jobs]);

  function changeSort(key) {
    setSort((current) => ({
      key,
      direction:
        current.key === key && current.direction === "asc" ? "desc" : "asc",
    }));
  }

  function clearFilters() {
    setSelectedPeriod(contextJob ? "all" : "current-vat");
    setSelectedSupplier("all");
    setSelectedTag("all");
    setSelectedJobId(contextJob ? String(contextJob.id) : "all");
    setSelectedCategory("all");
    setSelectedStatus("all");
    setSearchTerm("");
    setWarningView("all");
  }

  function viewWarning(type) {
    setWarningView((current) => (current === type ? "all" : type));
    setSelectedStatus("all");
  }

  function exportCsv() {
    const rows = [
      [
        "File",
        "Supplier",
        "Date",
        "Linked To",
        "File Types",
        "Tags",
        "Gross",
        "VAT",
        "Net",
        "VAT Treatment",
        "Status",
        "Notes",
      ],
    ];

    sortedFiles.forEach((file) => {
      rows.push([
        getFileName(file),
        file.supplier || "",
        getFileDate(file) || "",
        (file.links || []).map(getTargetName).join(" | "),
        getFileCategories(file).join(" | "),
        getFileTags(file).join(" | "),
        getFileTotal(file).toFixed(2),
        getFileVat(file).toFixed(2),
        getFileNet(file) === null ? "" : getFileNet(file).toFixed(2),
        file.vat?.reviewed ? vatTreatmentLabel(file.vat.status) : "Unreviewed",
        getFileStatus(file).label,
        (file.links || [])
          .map((link) => link.note)
          .filter(Boolean)
          .join(" | "),
      ]);
    });

    const csv = rows
      .map((row) =>
        row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","),
      )
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `files-costs-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  const editingFile = loggedFiles.find(
    (file) => String(file.id) === String(editingFileId),
  );
  const editGross = editForm.links.reduce(
    (sum, link) => sum + Number(link.cost || 0),
    0,
  );
  const editVatPreview = calculateVatRecord(
    editGross,
    editForm.vatTreatment,
    editForm.customVatAmount,
  );

  return (
    <main className="filesPage">
      <header className="filesPageHeader">
        <div>
          {contextJob && (
            <button
              type="button"
              className="filesTextButton"
              onClick={() => navigate("JobCard", { jobId: contextJob.id })}
            >
              ← Back to {contextJob.name || "job"}
            </button>
          )}
          <h1>
            {contextJob ? `${contextJob.name} files & costs` : "Files & Costs"}
          </h1>
          <p>Search, check and allocate every business record.</p>
        </div>

        <div className="filesHeaderActions">
          <label className="filesPeriodSelect">
            <span>Period</span>
            <select
              value={selectedPeriod}
              onChange={(event) => setSelectedPeriod(event.target.value)}
            >
              <option value="current-vat">
                {vatPeriods.find((period) => period.isCurrent)
                  ? `Current VAT period · ${vatPeriods.find((period) => period.isCurrent).label}`
                  : "Current VAT period"}
              </option>
              <optgroup label="Configured VAT periods">
                {vatPeriods.filter((period) => !period.isCurrent).map((period) => (
                  <option key={period.id} value={`vat:${period.id}`}>
                    {period.label}
                  </option>
                ))}
              </optgroup>
              <option value="current-month">Current month</option>
              <option value="previous-month">Previous month</option>
              <option value="current-year">Current year</option>
              <option value="all">All time</option>
              <optgroup label="Specific month">
                {monthOptions.map((month) => (
                  <option key={month.value} value={`month:${month.value}`}>
                    {month.label}
                  </option>
                ))}
              </optgroup>
            </select>
          </label>

          <button
            type="button"
            className="filesButton primary"
            onClick={() => navigate("UnsortedFiles", { openUploader: true })}
          >
            Upload files
          </button>
          <button
            type="button"
            className="filesButton primary"
            onClick={() => navigate("UnsortedFiles")}
          >
            Sort inbox{unsortedCount ? ` · ${unsortedCount}` : ""}
          </button>
          <button
            type="button"
            className="filesButton quiet"
            onClick={exportCsv}
          >
            Export CSV
          </button>
        </div>
      </header>

      <section
        className="filesMetricGrid"
        aria-label="Filtered financial summary"
      >
        <Metric label="Gross spend" value={money(filteredGross)} />
        <Metric
          label="VAT reclaimable"
          value={money(filteredVat)}
          detail={`${reviewedCostFiles} of ${costFileCount} cost records reviewed`}
          tone="positive"
        />
        <Metric
          label="Net cost recorded"
          value={money(filteredNet)}
          detail="Reviewed cost records only"
        />
        <Metric label="Records" value={filteredFiles.length} />
        <Metric
          label="VAT to review"
          value={filteredFiles.filter(fileHasMissingVat).length}
          tone={filteredFiles.some(fileHasMissingVat) ? "warning" : "positive"}
          onClick={() => viewWarning("missing-vat")}
        />
      </section>

      <section className="filesWarningQueue" aria-label="File issues">
        <WarningChip
          label="missing costs"
          count={warningCounts.missingCost}
          active={warningView === "missing-cost"}
          tone="danger"
          onClick={() => viewWarning("missing-cost")}
        />
        <WarningChip
          label="VAT unknown"
          count={warningCounts.missingVat}
          active={warningView === "missing-vat"}
          onClick={() => viewWarning("missing-vat")}
        />
        <WarningChip
          label="no job link"
          count={warningCounts.noJob}
          active={warningView === "no-job"}
          onClick={() => viewWarning("no-job")}
        />
        <WarningChip
          label="missing details"
          count={warningCounts.missingDetails}
          active={warningView === "missing-details"}
          onClick={() => viewWarning("missing-details")}
        />
        <WarningChip
          label="possible duplicates"
          count={warningCounts.duplicates}
          active={warningView === "duplicate"}
          onClick={() => viewWarning("duplicate")}
        />

        {!Object.values(warningCounts).some(Boolean) && (
          <span className="filesAllClear">No file issues in this view.</span>
        )}
      </section>

      <section className="filesFilterPanel">
        <label className="filesSearchField">
          <span>Search</span>
          <input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search supplier, filename, note, job or tag..."
          />
        </label>

        <label>
          <span>Supplier</span>
          <select
            value={selectedSupplier}
            onChange={(event) => setSelectedSupplier(event.target.value)}
          >
            <option value="all">All suppliers</option>
            {supplierOptions.map((supplier) => (
              <option key={supplier} value={supplier}>
                {supplier}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>Spend category</span>
          <select
            value={selectedTag}
            onChange={(event) => setSelectedTag(event.target.value)}
          >
            <option value="all">All categories</option>
            {TAG_OPTIONS.map((tag) => (
              <option key={tag} value={tag}>
                {tag}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>Job</span>
          <select
            value={selectedJobId}
            onChange={(event) => setSelectedJobId(event.target.value)}
          >
            <option value="all">All jobs</option>
            <option value="no-job">No job link</option>
            {jobOptions.map((job) => (
              <option key={job.value} value={job.value}>
                {job.label}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>File type</span>
          <select
            value={selectedCategory}
            onChange={(event) => setSelectedCategory(event.target.value)}
          >
            <option value="all">All file types</option>
            {categoryOptions.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>Status</span>
          <select
            value={selectedStatus}
            onChange={(event) => setSelectedStatus(event.target.value)}
          >
            <option value="all">All statuses</option>
            <option value="complete">Complete</option>
            <option value="missing-vat">VAT to review</option>
            <option value="missing-cost">Missing cost</option>
            <option value="missing-details">Missing details</option>
            <option value="no-job">No job link</option>
            <option value="duplicate">Possible duplicate</option>
            <option value="no-vat">Reviewed · no VAT</option>
            <option value="reference">Reference document</option>
          </select>
        </label>

        <button
          type="button"
          className="filesTextButton clear"
          onClick={clearFilters}
        >
          Clear filters
        </button>
      </section>

      <section className="filesRecordsPanel">
        <header className="filesRecordsHeader">
          <div>
            <h2>{sortedFiles.length} records</h2>
            {warningView !== "all" && (
              <button
                type="button"
                className="filesActiveFilter"
                onClick={() => setWarningView("all")}
              >
                Issue filter active · clear ×
              </button>
            )}
          </div>

          <div className="filesViewToggle">
            <button
              type="button"
              className={viewMode === "list" ? "active" : ""}
              onClick={() => setViewMode("list")}
            >
              List
            </button>
            <button
              type="button"
              className={viewMode === "job" ? "active" : ""}
              onClick={() => setViewMode("job")}
            >
              Group by job
            </button>
          </div>
        </header>

        {loading ? (
          <div className="filesEmptyState">Loading files...</div>
        ) : viewMode === "list" ? (
          <>
            <div className="filesTableScroll">
              <table className="filesTable">
                <thead>
                  <tr>
                    <SortHeading
                      label="File"
                      sortKey="name"
                      sort={sort}
                      onSort={changeSort}
                    />
                    <SortHeading
                      label="Date"
                      sortKey="date"
                      sort={sort}
                      onSort={changeSort}
                    />
                    <SortHeading
                      label="Supplier"
                      sortKey="supplier"
                      sort={sort}
                      onSort={changeSort}
                    />
                    <SortHeading
                      label="Linked job"
                      sortKey="job"
                      sort={sort}
                      onSort={changeSort}
                    />
                    <SortHeading
                      label="Category"
                      sortKey="category"
                      sort={sort}
                      onSort={changeSort}
                    />
                    <SortHeading
                      label="Gross"
                      sortKey="gross"
                      sort={sort}
                      onSort={changeSort}
                      numeric
                    />
                    <SortHeading
                      label="VAT"
                      sortKey="vat"
                      sort={sort}
                      onSort={changeSort}
                      numeric
                    />
                    <SortHeading
                      label="Net"
                      sortKey="net"
                      sort={sort}
                      onSort={changeSort}
                      numeric
                    />
                    <SortHeading
                      label="Status"
                      sortKey="status"
                      sort={sort}
                      onSort={changeSort}
                    />
                    <th aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {visibleFiles.map((file) => (
                    <FileTableRow
                      key={file.id || getFileName(file)}
                      file={file}
                      fileName={getFileName(file)}
                      fileUrl={getFileUrl(file)}
                      date={formatDate(getFileDate(file))}
                      supplier={
                        isReferenceFile(file)
                          ? "Not required"
                          : file.supplier || "Missing supplier"
                      }
                      referenceFile={isReferenceFile(file)}
                      jobs={getFileJobNames(file)}
                      tags={getFileTags(file)}
                      gross={getFileTotal(file)}
                      vat={getFileVat(file)}
                      net={getFileNet(file)}
                      status={getFileStatus(file)}
                      onEdit={() =>
                        startEditingFile(
                          file,
                          fileHasMissingVat(file) ? "vat" : "details",
                        )
                      }
                    />
                  ))}
                </tbody>
              </table>

              {!visibleFiles.length && (
                <div className="filesEmptyState">
                  No files match these filters.
                </div>
              )}
            </div>

            <Pagination
              page={safePage}
              pageCount={pageCount}
              total={sortedFiles.length}
              pageSize={PAGE_SIZE}
              onChange={setPage}
            />
          </>
        ) : (
          <div className="filesJobGroups">
            {groupedByJob.map(([key, group]) => (
              <section
                className="filesJobGroup"
                style={{ "--job-colour": group.colour }}
                key={key}
              >
                <header>
                  <div>
                    <h3>{group.title}</h3>
                    <span>{group.files.length} files</span>
                  </div>
                  <strong>{money(group.total)}</strong>
                </header>

                {group.files.map((file) => {
                  const status = getFileStatus(file);
                  return (
                    <button
                      type="button"
                      className="filesGroupedRow"
                      key={`${key}-${file.id}`}
                      onClick={() =>
                        startEditingFile(
                          file,
                          fileHasMissingVat(file) ? "vat" : "details",
                        )
                      }
                    >
                      <span>{getFileName(file)}</span>
                      <small>{formatDate(getFileDate(file))}</small>
                      <strong>{money(getFileTotal(file))}</strong>
                      <StatusBadge status={status} />
                    </button>
                  );
                })}
              </section>
            ))}

            {!groupedByJob.length && (
              <div className="filesEmptyState">No grouped files to show.</div>
            )}
          </div>
        )}
      </section>

      <section className="filesCategoryPanel">
        <h2>Spend by category</h2>
        {tagBreakdown.length ? (
          <div className="filesCategoryGrid">
            {tagBreakdown.map((item) => (
              <button
                type="button"
                key={item.tag}
                onClick={() => setSelectedTag(item.tag)}
              >
                <span>
                  <strong>{item.tag}</strong>
                  <b>{money(item.total)}</b>
                </span>
                <i>
                  <em
                    style={{ width: `${(item.total / maxTagTotal) * 100}%` }}
                  />
                </i>
              </button>
            ))}
          </div>
        ) : (
          <p>No categorised spend in this view.</p>
        )}
      </section>

      {editingFile && (
        <FileEditorModal
          file={editingFile}
          fileName={getFileName(editingFile)}
          fileUrl={getFileUrl(editingFile)}
          form={editForm}
          setForm={setEditForm}
          focus={editFocus}
          gross={editGross}
          vatPreview={editVatPreview}
          jobs={jobs}
          saving={savingFile}
          message={editMessage}
          onClose={cancelEditingFile}
          onSave={() => saveFileEdit(editingFile)}
          onDelete={() => deleteFile(editingFile)}
          onUpdateLink={updateEditLink}
          onAddLink={addEditLink}
          onRemoveLink={removeEditLink}
          getTargetValue={getTargetValue}
        />
      )}
    </main>
  );
}

function Metric({ label, value, detail = "", tone = "", onClick }) {
  const Component = onClick ? "button" : "div";

  return (
    <Component
      className={`filesMetric ${tone} ${onClick ? "clickable" : ""}`}
      onClick={onClick}
      type={onClick ? "button" : undefined}
    >
      <span>{label}</span>
      <strong>{value}</strong>
      {detail && <small>{detail}</small>}
    </Component>
  );
}

function WarningChip({ label, count, active, tone = "warning", onClick }) {
  if (!count) return null;

  return (
    <button
      type="button"
      className={`filesWarningChip ${tone} ${active ? "active" : ""}`}
      onClick={onClick}
    >
      <span>▲</span>
      <strong>{count}</strong> {label}
      <b>›</b>
    </button>
  );
}

function SortHeading({ label, sortKey, sort, onSort, numeric = false }) {
  const active = sort.key === sortKey;

  return (
    <th className={numeric ? "numeric" : ""}>
      <button type="button" onClick={() => onSort(sortKey)}>
        {label}
        <span aria-hidden="true">
          {active ? (sort.direction === "asc" ? "↑" : "↓") : "↕"}
        </span>
      </button>
    </th>
  );
}

function FileTableRow({
  file,
  fileName,
  fileUrl,
  date,
  supplier,
  referenceFile,
  jobs,
  tags,
  gross,
  vat,
  net,
  status,
  onEdit,
}) {
  const extension = fileName.split(".").pop()?.toLowerCase() || "file";

  return (
    <tr className={`filesRow ${status.tone}`}>
      <td>
        <div className="filesFileCell">
          <span className={`filesFileIcon ${extension}`}>
            {extension.slice(0, 3)}
          </span>
          <div>
            {fileUrl ? (
              <a href={fileUrl} target="_blank" rel="noreferrer">
                {fileName}
              </a>
            ) : (
              <strong>{fileName}</strong>
            )}
            <small>
              {file.attachments?.length
                ? `${file.attachments.length} attachments`
                : extension.toUpperCase()}
            </small>
          </div>
        </div>
      </td>
      <td>{date}</td>
      <td
        className={
          referenceFile
            ? "filesNotRequired"
            : !file.supplier
              ? "filesMissingValue"
              : ""
        }
      >
        {supplier}
      </td>
      <td>
        {jobs.length ? (
          jobs.map((job) => (
            <span className="filesLinkText" key={job}>
              {job}
            </span>
          ))
        ) : (
          <span className="filesMissingValue">No job linked</span>
        )}
      </td>
      <td>
        {tags.length ? (
          tags.join(", ")
        ) : (
          <span className="filesMissingValue">Missing</span>
        )}
      </td>
      <td className="numeric">
        <strong>{referenceFile ? "—" : money(gross)}</strong>
      </td>
      <td
        className={`numeric ${!file.vat?.reviewed && gross > 0 ? "filesMissingValue" : ""}`}
      >
        {referenceFile
          ? "—"
          : file.vat?.reviewed
            ? money(vat)
            : gross > 0
              ? "Unknown"
              : "—"}
      </td>
      <td className="numeric">
        {referenceFile ? "—" : file.vat?.reviewed ? money(net) : "—"}
      </td>
      <td>
        <StatusBadge status={status} />
      </td>
      <td>
        <button type="button" className="filesRowAction" onClick={onEdit}>
          {status.key === "missing-vat" ? "Fix VAT" : "Edit"}
        </button>
      </td>
    </tr>
  );
}

function StatusBadge({ status }) {
  return <span className={`filesStatus ${status.tone}`}>{status.label}</span>;
}

function Pagination({ page, pageCount, total, pageSize, onChange }) {
  if (!total) return null;

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);
  const visiblePages = Array.from(
    { length: pageCount },
    (_, index) => index + 1,
  )
    .filter(
      (number) =>
        number === 1 || number === pageCount || Math.abs(number - page) <= 1,
    )
    .slice(0, 7);

  return (
    <footer className="filesPagination">
      <span>
        Showing {start}–{end} of {total}
      </span>
      <div>
        <button
          type="button"
          disabled={page === 1}
          onClick={() => onChange(page - 1)}
        >
          Previous
        </button>
        {visiblePages.map((number) => (
          <button
            type="button"
            key={number}
            className={number === page ? "active" : ""}
            onClick={() => onChange(number)}
          >
            {number}
          </button>
        ))}
        <button
          type="button"
          disabled={page === pageCount}
          onClick={() => onChange(page + 1)}
        >
          Next
        </button>
      </div>
    </footer>
  );
}

function FileEditorModal({
  file,
  fileName,
  fileUrl,
  form,
  setForm,
  focus,
  gross,
  vatPreview,
  jobs,
  saving,
  message,
  onClose,
  onSave,
  onDelete,
  onUpdateLink,
  onAddLink,
  onRemoveLink,
  getTargetValue,
}) {
  const extension = fileName.split(".").pop()?.toLowerCase();
  const imageFile = ["jpg", "jpeg", "png", "webp", "gif", "heic"].includes(
    extension,
  );
  const referenceOnly =
    form.links.length > 0 && form.links.every((link) => !linkUsesCost(link));

  return (
    <div
      className="filesModalBackdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="filesEditorModal"
        role="dialog"
        aria-modal="true"
        aria-label={`Edit ${fileName}`}
      >
        <header className="filesEditorHeader">
          <div>
            <span>Edit file</span>
            <h2>{fileName}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close editor">
            ×
          </button>
        </header>

        <div className="filesEditorBody">
          <aside className="filesPreviewPanel">
            <div className="filesPreviewFrame">
              {fileUrl ? (
                imageFile ? (
                  <img src={fileUrl} alt={fileName} />
                ) : (
                  <iframe src={fileUrl} title={fileName} />
                )
              ) : (
                <div>No preview available</div>
              )}
            </div>
            {fileUrl && (
              <a href={fileUrl} target="_blank" rel="noreferrer">
                Open original ↗
              </a>
            )}
          </aside>

          <div className="filesEditorForm">
            <section className="filesEditorSection">
              <h3>Record details</h3>
              {referenceOnly ? (
                <div className="filesReferenceNotice">
                  <strong>Job reference document</strong>
                  <span>Supplier, purchase cost and VAT are not required.</span>
                </div>
              ) : (
                <div className="filesEditorGrid two">
                  <label>
                    <span>Supplier</span>
                    <input
                      value={form.supplier}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          supplier: event.target.value,
                        }))
                      }
                      placeholder="Supplier"
                    />
                  </label>
                  <label>
                    <span>Purchase date</span>
                    <input
                      type="date"
                      value={form.purchaseDate}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          purchaseDate: event.target.value,
                        }))
                      }
                    />
                  </label>
                </div>
              )}
            </section>

            <section className="filesEditorSection">
              <div className="filesEditorSectionHeader">
                <h3>Assignments</h3>
                <button
                  type="button"
                  className="filesTextButton"
                  onClick={onAddLink}
                >
                  + Add assignment
                </button>
              </div>

              <div className="filesAssignments">
                {form.links.map((link, index) => (
                  <div className="filesAssignment" key={index}>
                    <label className="wide">
                      <span>Link to</span>
                      <select
                        value={getTargetValue(link)}
                        onChange={(event) =>
                          onUpdateLink(index, "targetValue", event.target.value)
                        }
                      >
                        <option value="general:no-job">No Job Link</option>
                        <optgroup label="Jobs">
                          {jobs.map((job) => (
                            <option key={job.id} value={`job:${job.id}`}>
                              {job.name || job.address || `Job ${job.id}`}
                            </option>
                          ))}
                        </optgroup>
                      </select>
                    </label>

                    <label>
                      <span>File type</span>
                      <select
                        value={link.category}
                        onChange={(event) =>
                          onUpdateLink(index, "category", event.target.value)
                        }
                      >
                        {FILE_CATEGORIES.map((category) => (
                          <option key={category} value={category}>
                            {category}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label>
                      <span>Category</span>
                      <select
                        value={link.tag}
                        onChange={(event) =>
                          onUpdateLink(index, "tag", event.target.value)
                        }
                      >
                        <option value="">Select category</option>
                        {TAG_OPTIONS.map((tag) => (
                          <option key={tag} value={tag}>
                            {tag}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label>
                      <span>Gross cost</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={linkUsesCost(link) ? link.cost : ""}
                        disabled={!linkUsesCost(link)}
                        onChange={(event) =>
                          onUpdateLink(index, "cost", event.target.value)
                        }
                        placeholder={
                          linkUsesCost(link) ? "0.00" : "Not required"
                        }
                      />
                    </label>

                    <label className="wide">
                      <span>Note</span>
                      <input
                        value={link.note}
                        onChange={(event) =>
                          onUpdateLink(index, "note", event.target.value)
                        }
                        placeholder="Optional note"
                      />
                    </label>

                    {form.links.length > 1 && (
                      <button
                        type="button"
                        className="filesRemoveAssignment"
                        onClick={() => onRemoveLink(index)}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </section>

            {referenceOnly ? (
              <section className="filesEditorSection filesReferenceSummary">
                <span aria-hidden="true">✓</span>
                <div>
                  <h3>Ready as a reference document</h3>
                  <p>
                    This file will stay with the job without affecting spend,
                    profit or VAT.
                  </p>
                </div>
              </section>
            ) : (
              <section
                className={`filesEditorSection filesVatSection ${focus === "vat" ? "attention" : ""}`}
              >
              <div className="filesEditorSectionHeader">
                <div>
                  <h3>VAT treatment</h3>
                  <p>
                    VAT is only included in the dashboard after this record is
                    reviewed.
                  </p>
                </div>
                {!vatPreview.reviewed && (
                  <span className="filesNeedsReview">Needs review</span>
                )}
              </div>

              <label>
                <span>Treatment</span>
                <select
                  autoFocus={focus === "vat"}
                  value={form.vatTreatment}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      vatTreatment: event.target.value,
                    }))
                  }
                >
                  {VAT_TREATMENTS.map((treatment) => (
                    <option key={treatment.value} value={treatment.value}>
                      {treatment.label}
                    </option>
                  ))}
                </select>
              </label>

              {form.vatTreatment === "custom" && (
                <label>
                  <span>VAT shown on document</span>
                  <input
                    type="number"
                    min="0"
                    max={gross}
                    step="0.01"
                    value={form.customVatAmount}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        customVatAmount: event.target.value,
                      }))
                    }
                    placeholder="0.00"
                  />
                </label>
              )}

              <div className="filesVatSummary">
                <div>
                  <span>Gross</span>
                  <strong>{money(gross)}</strong>
                </div>
                <div>
                  <span>VAT</span>
                  <strong>
                    {vatPreview.reviewed
                      ? money(vatPreview.amount)
                      : "Not recorded"}
                  </strong>
                </div>
                <div>
                  <span>Net</span>
                  <strong>
                    {vatPreview.reviewed
                      ? money(vatPreview.net)
                      : "Not recorded"}
                  </strong>
                </div>
              </div>
              </section>
            )}

            {message && (
              <div className="filesEditMessage" role="status">
                {message}
              </div>
            )}
          </div>
        </div>

        <footer className="filesEditorFooter">
          <button
            type="button"
            className="filesButton danger"
            onClick={onDelete}
            disabled={saving}
          >
            Delete file
          </button>
          <div>
            <button
              type="button"
              className="filesButton quiet"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="button"
              className="filesButton success"
              onClick={onSave}
              disabled={saving}
            >
              {saving ? "Saving..." : "Save changes"}
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}

export default Files;
