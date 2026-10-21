import { useEffect, useRef, useState } from "react";
import logo from "../../assets/logo.png";
import {
  MapContainer,
  TileLayer,
  Marker,
  Circle,
  Popup,
  useMap,
  useMapEvents,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import "./JobOverview.css";
import JobColourPicker from "../JobColourPicker";
import { getJobColour } from "../jobColour";

const API_BASE = "";
const DEFAULT_CENTER = [52.7689, -0.9007];
const TRAVEL_COST_PER_MILE = 0.45;
const JOB_REFERENCE_CATEGORIES = new Set([
  "drawing",
  "certificate",
  "licence",
  "quote",
]);

const STATUS_OPTIONS = [
  "Lead",
  "Contacted",
  "To-Quote",
  "Quoted",
  "Accepted",
  "Approved",
  "Booked",
  "Not Started",
  "In Progress",
  "On Hold",
  "Completed",
];

const JOB_TYPE_OPTIONS = [
  "Extension",
  "Structural work",
  "Rendering",
  "Plastering",
  "Kitchen",
  "Bathroom",
  "General building",
  "Internal / overhead",
  "Other",
];

const SOURCE_OPTIONS = [
  "Google",
  "Website",
  "Facebook",
  "Referral",
  "Existing customer",
  "Agent / contractor",
  "Other",
];

const CLOSE_OUTCOME_OPTIONS = [
  { value: "lost_quote", label: "Lost quote" },
  { value: "customer_cancelled", label: "Customer cancelled" },
  { value: "went_cold", label: "Went cold / no response" },
  { value: "not_quoted", label: "Did not quote" },
  { value: "declined_by_jnr", label: "Declined by JNR" },
  { value: "duplicate_legacy", label: "Duplicate / legacy record" },
  { value: "other", label: "Other" },
];

const LOSS_REASON_OPTIONS = [
  { value: "quote_too_high", label: "Quote too high" },
  { value: "another_builder", label: "Chose another builder" },
  { value: "timing", label: "Timing or availability" },
  { value: "scope_changed", label: "Scope changed" },
  { value: "no_reason", label: "No reason given" },
  { value: "other", label: "Other" },
];

function optionLabel(options, value, fallback = "Not recorded") {
  return options.find((option) => option.value === value)?.label || fallback;
}

function makeTodoId() {
  return `todo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function jobAddressParts(job) {
  const savedPostcode = String(job?.postcode || "").trim().toUpperCase();
  const savedSiteAddress = String(job?.siteAddress || "").trim();
  if (savedSiteAddress || savedPostcode) {
    return { siteAddress: savedSiteAddress, postcode: savedPostcode };
  }

  const fullAddress = String(job?.address || job?.location?.address || "").trim();
  const match = fullAddress.match(
    /(?:,?\s+)([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})$/i,
  );
  if (!match) return { siteAddress: fullAddress, postcode: "" };

  return {
    siteAddress: fullAddress.slice(0, match.index).replace(/,\s*$/, "").trim(),
    postcode: match[1].toUpperCase().replace(/\s+/g, " "),
  };
}

function money(value) {
  return `£${Number(value || 0).toLocaleString("en-GB", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatActivityDate(value) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
  });
}

function fileName(file) {
  return file?.originalName || file?.fileName || file?.name || "Job document";
}

function fileUrl(file) {
  return file?.url ? `${API_BASE}${file.url}` : "";
}

function fileExtension(file) {
  return fileName(file).split(".").pop()?.toLowerCase() || "file";
}

function referenceCategoryLabel(value) {
  const category = String(value || "document").trim().toLowerCase();
  if (category === "drawing") return "Drawing / plan";
  if (category === "certificate") return "Certificate";
  if (category === "licence") return "Licence";
  if (category === "quote") return "Supporting quote";
  return "Job document";
}

function dateInputValue(value) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return date.toISOString().slice(0, 10);
}

function blankCustomerDetails() {
  return {
    name: "",
    phone: "",
    email: "",
    address: "",
  };
}

function hasCoordinates(location) {
  return (
    Number.isFinite(Number(location?.lat)) &&
    Number.isFinite(Number(location?.lng))
  );
}

function statusTone(status) {
  const value = String(status || "").toLowerCase();

  if (value.includes("lost")) {
    return "lost";
  }

  if (value.includes("complete") || value.includes("approved")) {
    return "success";
  }

  if (value.includes("hold") || value.includes("quote")) {
    return "warning";
  }

  if (value.includes("progress") || value.includes("booked")) {
    return "active";
  }

  return "neutral";
}

function itemDate(item) {
  return (
    item?.updatedAt ||
    item?.createdAt ||
    item?.acceptedAt ||
    item?.issuedAt ||
    item?.sentAt ||
    item?.paidAt ||
    item?.paymentDate ||
    item?.date ||
    item?.invoiceDate ||
    ""
  );
}

function documentLabel(prefix, item, index) {
  const reference =
    item?.number || item?.reference || item?.documentNumber || item?.id;

  return reference ? `${prefix} ${reference}` : `${prefix} ${index + 1}`;
}

function buildRecentActivity(job) {
  const quotes = (job?.quotes || []).map((quote, index) => ({
    label: `${documentLabel("Estimate", quote, index)} ${
      quote.status ? quote.status.toLowerCase() : "created"
    }`,
    date: itemDate(quote),
  }));

  const invoices = (job?.invoices || []).map((invoice, index) => ({
    label: `${documentLabel("Invoice", invoice, index)} ${
      invoice.status ? invoice.status.toLowerCase() : "created"
    }`,
    date: itemDate(invoice),
  }));

  const payments = (job?.payments || []).map((payment) => ({
    label: `Payment received · ${money(payment.amount)}`,
    date: itemDate(payment),
  }));

  const portalActivity = (job?.portal?.activity || []).map((activity) => ({
    label: activity.label || activity.message || activity.type || "Portal update",
    date: itemDate(activity),
  }));

  const jobCreated = job?.createdAt
    ? [{ label: "Job created", date: job.createdAt }]
    : [];

  const closed = job?.archiveMeta?.archivedAt
    ? [{
        label: `Job closed · ${job.archiveMeta.label || "Outcome recorded"}`,
        date: job.archiveMeta.archivedAt,
      }]
    : [];

  return [
    ...quotes,
    ...invoices,
    ...payments,
    ...portalActivity,
    ...closed,
    ...jobCreated,
  ]
    .filter((activity) => activity.label)
    .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
    .slice(0, 5);
}

function FlyToLocation({ location }) {
  const map = useMap();

  useEffect(() => {
    if (hasCoordinates(location)) {
      map.flyTo([Number(location.lat), Number(location.lng)], 17, {
        duration: 1.1,
      });
    }
  }, [location?.lat, location?.lng, map]);

  return null;
}

function JobPinPicker({ location, onPick }) {
  useMapEvents({
    click(event) {
      onPick({ lat: event.latlng.lat, lng: event.latlng.lng });
    },
  });

  if (!hasCoordinates(location)) return null;

  const position = [Number(location.lat), Number(location.lng)];

  return (
    <>
      <Marker position={position}>
        <Popup>Job geofence centre</Popup>
      </Marker>

      <Circle
        center={position}
        radius={Number(location.radiusMeters || 150)}
        pathOptions={{
          color: "#52dc91",
          fillColor: "#52dc91",
          fillOpacity: 0.2,
          weight: 3,
        }}
      />
    </>
  );
}

function JobHeroMap({ location }) {
  if (!hasCoordinates(location)) return null;

  const position = [Number(location.lat), Number(location.lng)];

  return (
    <MapContainer
      center={position}
      zoom={15}
      zoomControl={false}
      dragging={false}
      scrollWheelZoom={false}
      doubleClickZoom={false}
      boxZoom={false}
      keyboard={false}
      touchZoom={false}
    >
      <TileLayer
        attribution="&copy; OpenStreetMap"
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Marker position={position} />
      <Circle
        center={position}
        radius={Number(location.radiusMeters || 150)}
        pathOptions={{
          color: "#5f89ff",
          fillColor: "#5f89ff",
          fillOpacity: 0.16,
          weight: 2,
        }}
      />
    </MapContainer>
  );
}

function JobOverview({
  job,
  onUpdate,
  onArchive,
  onUnarchive,
  navigate,
  jobFiles = [],
  fileCount = 0,
  fileLinkedCost = 0,
  currentUser,
}) {
  const [localJob, setLocalJob] = useState(job);
  const [editableJob, setEditableJob] = useState(job);
  const [isEditingJob, setIsEditingJob] = useState(false);
  const [savingJob, setSavingJob] = useState(false);
  const [jobMessage, setJobMessage] = useState("");

  const [customerDetails, setCustomerDetails] = useState(
    job?.customerDetails || blankCustomerDetails(),
  );
  const [editingCustomer, setEditingCustomer] = useState(false);
  const [savingCustomer, setSavingCustomer] = useState(false);
  const [customerMessage, setCustomerMessage] = useState("");

  const [locationMessage, setLocationMessage] = useState("");
  const [savingLocation, setSavingLocation] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [showCloseForm, setShowCloseForm] = useState(false);
  const [closeOutcome, setCloseOutcome] = useState("lost_quote");
  const [lossReason, setLossReason] = useState("quote_too_high");
  const [closeNotes, setCloseNotes] = useState("");
  const [winningQuote, setWinningQuote] = useState("");
  const [savingClose, setSavingClose] = useState(false);
  const [closeMessage, setCloseMessage] = useState("");
  const [todoDraft, setTodoDraft] = useState("");
  const [todoHigh, setTodoHigh] = useState(false);
  const [savingTodo, setSavingTodo] = useState(false);
  const [todoMessage, setTodoMessage] = useState("");
  const [immichPhotos, setImmichPhotos] = useState([]);
  const [refreshingPhotos, setRefreshingPhotos] = useState(false);
  const [photoMessage, setPhotoMessage] = useState("");
  const [tripLinks, setTripLinks] = useState([]);
  const [coverMessage, setCoverMessage] = useState("");
  const [savingCoverId, setSavingCoverId] = useState("");
  const [removingPhotoId, setRemovingPhotoId] = useState("");
  const [showAllPhotos, setShowAllPhotos] = useState(false);
  const [teamMembers, setTeamMembers] = useState([]);
  const [scheduleResources, setScheduleResources] = useState([]);
  const [scheduleEntries, setScheduleEntries] = useState([]);
  const [pricingSummary, setPricingSummary] = useState({
    blockCount: 0,
    itemCount: 0,
    workingTotalPence: 0,
  });

  const printRef = useRef(null);
  const photosRef = useRef(null);
  const editPanelRef = useRef(null);
  const scannedPhotoJobs = useRef(new Set());

  useEffect(() => {
    setLocalJob(job);
    setEditableJob(job);
    setCustomerDetails(job?.customerDetails || blankCustomerDetails());
    setIsEditingJob(false);
    setEditingCustomer(false);
    setCoverMessage("");
    setSavingCoverId("");
    setRemovingPhotoId("");
    setShowAllPhotos(false);
    setShowCloseForm(false);
    setCloseOutcome("lost_quote");
    setLossReason("quote_too_high");
    setCloseNotes("");
    setWinningQuote("");
    setCloseMessage("");
    setTodoDraft("");
    setTodoHigh(false);
    setTodoMessage("");
    setPhotoMessage("");
  }, [job]);

  useEffect(() => {
    if (!job?.id) return;

    const jobId = String(job.id);
    if (!scannedPhotoJobs.current.has(jobId)) {
      scannedPhotoJobs.current.add(jobId);
      refreshImmichPhotos(job.id, false);
    } else {
      loadImmichPhotos(job.id);
    }
  }, [job?.id]);

  useEffect(() => {
    if (!job?.id || currentUser?.role !== "admin") return;
    let cancelled = false;
    Promise.all([
      fetch(`${API_BASE}/api/team-members`).then((response) => response.ok ? response.json() : { members: [] }),
      fetch(`${API_BASE}/api/resources`).then((response) => response.ok ? response.json() : { resources: [] }),
      fetch(`${API_BASE}/api/schedule?jobId=${encodeURIComponent(job.id)}`).then((response) => response.ok ? response.json() : { entries: [] }),
    ]).then(([memberData, resourceData, scheduleData]) => {
      if (cancelled) return;
      setTeamMembers(Array.isArray(memberData.members) ? memberData.members : []);
      setScheduleResources(Array.isArray(resourceData.resources) ? resourceData.resources : []);
      setScheduleEntries(Array.isArray(scheduleData.entries) ? scheduleData.entries : []);
    }).catch((error) => console.error("Could not load job scheduling data:", error));
    return () => { cancelled = true; };
  }, [job?.id, currentUser?.role]);

  useEffect(() => {
    if (!job?.id) return undefined;
    let cancelled = false;
    setPricingSummary({ blockCount: 0, itemCount: 0, workingTotalPence: 0 });

    fetch(`${API_BASE}/api/jobs/${encodeURIComponent(job.id)}/pricing-notes/summary`, {
      credentials: "include",
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Pricing notes summary could not be loaded");
        return response.json();
      })
      .then((summary) => {
        if (!cancelled) {
          setPricingSummary({
            blockCount: Number(summary.blockCount || 0),
            itemCount: Number(summary.itemCount || 0),
            workingTotalPence: Number(summary.workingTotalPence || 0),
          });
        }
      })
      .catch((error) => {
        console.error("Failed to load pricing notes summary:", error);
      });

    return () => {
      cancelled = true;
    };
  }, [job?.id]);

  useEffect(() => {
    async function fetchTripLinks() {
      try {
        const response = await fetch(`${API_BASE}/api/traccar/trip-links`);
        if (!response.ok) throw new Error("Trip links could not be loaded");

        const data = await response.json();
        setTripLinks(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error("Failed to fetch trip data:", error);
        setTripLinks([]);
      }
    }

    fetchTripLinks();
  }, []);

  async function loadImmichPhotos(jobId) {
    try {
      const response = await fetch(`${API_BASE}/api/immich/job/${jobId}`);
      if (!response.ok) throw new Error("Photos could not be loaded");

      const data = await response.json();
      setImmichPhotos(Array.isArray(data.links) ? data.links : []);
    } catch (error) {
      console.error("Failed to load job photos:", error);
      setImmichPhotos([]);
    }
  }

  async function refreshImmichPhotos(jobId, showFeedback = true) {
    if (refreshingPhotos) return;

    setRefreshingPhotos(true);
    if (showFeedback) setPhotoMessage("Checking Immich for new job photos...");

    try {
      const response = await fetch(
        `${API_BASE}/api/immich/scan?jobId=${encodeURIComponent(jobId)}`,
      );

      if (!response.ok) throw new Error("Immich scan failed");

      const result = await response.json();
      await loadImmichPhotos(jobId);

      if (showFeedback || Number(result.matched || 0) > 0) {
        setPhotoMessage(
          Number(result.matched || 0) > 0
            ? `${result.matched} new photo${result.matched === 1 ? "" : "s"} linked.`
            : "Photos are up to date.",
        );
      }
    } catch (error) {
      console.error("Could not refresh Immich photos:", error);
      await loadImmichPhotos(jobId);
      if (showFeedback) {
        setPhotoMessage("Could not refresh photos from Immich.");
      }
    } finally {
      setRefreshingPhotos(false);
    }
  }

  function updateEditableJob(field, value) {
    setEditableJob((current) => ({ ...current, [field]: value }));
  }

  function updateEditableLocation(nextLocation) {
    setEditableJob((current) => ({
      ...current,
      location: {
        ...(current.location || {}),
        ...nextLocation,
      },
    }));
  }

  function updateLocation(nextLocation) {
    setLocalJob((current) => ({
      ...current,
      location: {
        ...(current.location || {}),
        ...nextLocation,
      },
    }));
  }

  function beginJobEdit() {
    const addressParts = jobAddressParts(localJob);
    setEditableJob({
      ...localJob,
      siteAddress: addressParts.siteAddress,
      postcode: addressParts.postcode,
      jobType: localJob.jobType || localJob.type || "General building",
      source: localJob.source || localJob.leadSource || "",
      targetEndDate: localJob.targetEndDate || localJob.endDate || "",
      assignedUserIds: Array.isArray(localJob.assignedUserIds)
        ? localJob.assignedUserIds.map(String)
        : [],
    });
    setJobMessage("");
    setIsEditingJob(true);

    window.setTimeout(() => {
      editPanelRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 60);
  }

  function cancelEditJob() {
    setEditableJob(localJob);
    setIsEditingJob(false);
    setJobMessage("");
  }

  function toggleAssignedUser(userId) {
    setEditableJob((current) => {
      const selected = new Set((current.assignedUserIds || []).map(String));
      if (selected.has(String(userId))) selected.delete(String(userId));
      else selected.add(String(userId));
      return { ...current, assignedUserIds: [...selected] };
    });
  }

  async function persistJob(nextJob) {
    if (typeof onUpdate !== "function") {
      throw new Error("Job updating is not available");
    }

    const result = await onUpdate(nextJob);
    const savedJob = result && typeof result === "object" ? result : nextJob;

    setLocalJob(savedJob);
    setEditableJob(savedJob);
    return savedJob;
  }

  async function saveJobDetails() {
    if (!editableJob?.name?.trim()) {
      setJobMessage("Add a job name before saving.");
      return;
    }

    if (
      editableJob.startDate &&
      editableJob.targetEndDate &&
      editableJob.targetEndDate < editableJob.startDate
    ) {
      setJobMessage("The target finish cannot be before the start date.");
      return;
    }

    setSavingJob(true);
    setJobMessage("Saving job details...");

    const siteAddress = String(
      editableJob.siteAddress || editableJob.address || "",
    ).trim();
    const postcode = String(editableJob.postcode || "")
      .trim()
      .toUpperCase();
    const nextAddress = [siteAddress, postcode]
      .filter(Boolean)
      .join(", ");

    const nextJob = {
      ...localJob,
      ...editableJob,
      name: editableJob.name.trim(),
      siteAddress,
      postcode,
      address: nextAddress,
      location: {
        ...(localJob.location || {}),
        ...(editableJob.location || {}),
        address: nextAddress,
      },
      updatedAt: new Date().toISOString(),
    };

    try {
      await persistJob(nextJob);
      setIsEditingJob(false);
      setJobMessage("Job details saved.");
    } catch (error) {
      console.error(error);
      setJobMessage("Could not save job details.");
    } finally {
      setSavingJob(false);
    }
  }

  async function geocodeAddress() {
    const address =
      localJob.location?.address || localJob.address || localJob.name || "";

    if (!address.trim()) {
      setLocationMessage("Add an address first.");
      return;
    }

    setLocationMessage("Searching address...");

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(
          address,
        )}`,
      );

      if (!response.ok) throw new Error("Address search failed");

      const data = await response.json();

      if (!data?.length) {
        setLocationMessage("Address not found.");
        return;
      }

      updateLocation({
        lat: Number(data[0].lat),
        lng: Number(data[0].lon),
        radiusMeters: Number(localJob.location?.radiusMeters || 150),
        address,
      });
      setLocationMessage("Address found. Refine the pin if needed, then save.");
    } catch (error) {
      console.error(error);
      setLocationMessage("Address search failed.");
    }
  }

  async function saveJobLocation() {
    if (!hasCoordinates(localJob.location)) {
      setLocationMessage("Search the address or drop a pin first.");
      return;
    }

    setSavingLocation(true);
    setLocationMessage("Saving geofence...");

    const address = localJob.location?.address || localJob.address || "";
    const nextJob = {
      ...localJob,
      address,
      location: {
        ...(localJob.location || {}),
        lat: Number(localJob.location.lat),
        lng: Number(localJob.location.lng),
        radiusMeters: Number(localJob.location.radiusMeters || 150),
        address,
        updatedAt: new Date().toISOString(),
      },
      updatedAt: new Date().toISOString(),
    };

    try {
      await persistJob(nextJob);
      setLocationMessage("Geofence saved.");
    } catch (error) {
      console.error(error);
      setLocationMessage("Failed to save geofence.");
    } finally {
      setSavingLocation(false);
    }
  }

  function cancelCustomerEdit() {
    setCustomerDetails(localJob.customerDetails || blankCustomerDetails());
    setEditingCustomer(false);
    setCustomerMessage("");
  }

  async function saveCustomerDetails() {
    if (!customerDetails.name.trim()) {
      setCustomerMessage("Add the customer name first.");
      return;
    }

    setSavingCustomer(true);
    setCustomerMessage("Saving customer details...");

    const nextJob = {
      ...localJob,
      clientName: customerDetails.name.trim(),
      client: customerDetails.name.trim(),
      clientPhone: customerDetails.phone.trim(),
      clientEmail: customerDetails.email.trim(),
      customerDetails: {
        name: customerDetails.name.trim(),
        phone: customerDetails.phone.trim(),
        email: customerDetails.email.trim(),
        address: customerDetails.address.trim(),
      },
      updatedAt: new Date().toISOString(),
    };

    try {
      const savedJob = await persistJob(nextJob);
      setCustomerDetails(savedJob.customerDetails || customerDetails);
      setEditingCustomer(false);
      setCustomerMessage("Customer details saved.");
    } catch (error) {
      console.error(error);
      setCustomerMessage("Could not save customer details.");
    } finally {
      setSavingCustomer(false);
    }
  }

  function goToDocuments() {
    navigate("JobDocuments", { jobId: localJob.id });
  }

  function goToFiles() {
    navigate("Files", { jobId: localJob.id });
  }

  function goToJourneys() {
    navigate("JobHeatMap", { jobId: localJob.id });
  }

  function showPhotos() {
    photosRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  async function selectCoverImage(assetId) {
    if (savingCoverId) return;

    const nextCoverId = assetId ? String(assetId) : null;
    setSavingCoverId(nextCoverId || "automatic");
    setCoverMessage(
      nextCoverId
        ? "Saving this photo as the homepage cover..."
        : "Restoring the automatic homepage cover...",
    );

    try {
      await persistJob({
        ...localJob,
        coverImageAssetId: nextCoverId,
        updatedAt: new Date().toISOString(),
      });
      setCoverMessage(
        nextCoverId
          ? "Homepage cover saved."
          : "The homepage will now use the newest linked photo.",
      );
    } catch (error) {
      console.error("Could not save the homepage cover:", error);
      setCoverMessage("Could not save the homepage cover.");
    } finally {
      setSavingCoverId("");
    }
  }

  async function excludePhoto(assetId) {
    if (!assetId || removingPhotoId) return;

    const confirmed = window.confirm(
      `Remove this photo from ${localJob.name || "this job"}? It will stay in Immich and will not be linked to this job again.`,
    );

    if (!confirmed) return;

    const normalizedAssetId = String(assetId);
    const wasCover =
      String(localJob.coverImageAssetId || "") === normalizedAssetId;

    setRemovingPhotoId(normalizedAssetId);
    setPhotoMessage("Removing photo from this job...");

    try {
      const response = await fetch(
        `${API_BASE}/api/immich/job/${encodeURIComponent(localJob.id)}/${encodeURIComponent(normalizedAssetId)}`,
        { method: "DELETE" },
      );
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(result.error || "Could not unlink photo");
      }

      setImmichPhotos((current) =>
        current.filter(
          (photo) =>
            String(photo.assetId || photo.id || "") !== normalizedAssetId,
        ),
      );

      if (wasCover) {
        const coverResetJob = result.job || {
          ...localJob,
          coverImageAssetId: null,
          updatedAt: new Date().toISOString(),
        };

        try {
          await persistJob(coverResetJob);
          setCoverMessage(
            "That cover was removed. Automatic cover selection is active again.",
          );
        } catch (error) {
          console.error("Could not refresh the cleared cover in the app:", error);
          setLocalJob(coverResetJob);
          setEditableJob(coverResetJob);
          setCoverMessage(
            "The cover was cleared on the server. Reload the app if the old cover remains visible.",
          );
        }
      }

      setPhotoMessage(
        "Photo removed. It remains in Immich and will not return to this job on Refresh.",
      );
    } catch (error) {
      console.error("Could not remove the photo from this job:", error);
      setPhotoMessage("Could not remove this photo from the job.");
    } finally {
      setRemovingPhotoId("");
    }
  }

  function printOverview() {
    window.print();
  }

  function beginCloseJob() {
    const existing = localJob.archiveMeta || {};
    setCloseOutcome(existing.type || "lost_quote");
    setLossReason(existing.reason || "quote_too_high");
    setCloseNotes(existing.notes || "");
    setWinningQuote(
      existing.winningQuote === null || existing.winningQuote === undefined
        ? ""
        : String(existing.winningQuote),
    );
    setCloseMessage("");
    setShowCloseForm(true);
  }

  async function restoreJob() {
    if (archiving) return;
    const confirmed = window.confirm(
      `Restore ${localJob.name || "this job"} to ${
        localJob.archivedFromStatus || localJob.status || "the live jobs list"
      }?`,
    );

    if (!confirmed) return;

    setArchiving(true);

    try {
      if (typeof onUnarchive !== "function") throw new Error("Action unavailable");

      const result = await onUnarchive(localJob.id);
      if (result && typeof result === "object") {
        setLocalJob(result);
        setEditableJob(result);
      }
    } catch (error) {
      console.error("Could not restore job:", error);
      setJobMessage("Could not restore this job.");
    } finally {
      setArchiving(false);
    }
  }

  async function closeJob() {
    if (savingClose) return;

    const parsedWinningQuote = winningQuote === "" ? null : Number(winningQuote);
    if (
      winningQuote !== "" &&
      (!Number.isFinite(parsedWinningQuote) || parsedWinningQuote < 0)
    ) {
      setCloseMessage("Enter a valid winning quote or leave it blank.");
      return;
    }

    const archiveMeta = {
      type: closeOutcome,
      label: optionLabel(CLOSE_OUTCOME_OPTIONS, closeOutcome),
      reason: closeOutcome === "lost_quote" ? lossReason : null,
      reasonLabel:
        closeOutcome === "lost_quote"
          ? optionLabel(LOSS_REASON_OPTIONS, lossReason)
          : null,
      notes: closeNotes.trim(),
      quotedPrice: contractValue,
      winningQuote: closeOutcome === "lost_quote" ? parsedWinningQuote : null,
      archivedAt: localJob.archiveMeta?.archivedAt || new Date().toISOString(),
      classifiedAt: new Date().toISOString(),
    };

    setSavingClose(true);
    setCloseMessage(
      localJob.archived ? "Saving classification..." : "Closing and storing job...",
    );

    try {
      await persistJob({
        ...localJob,
        archived: true,
        archivedFromStatus:
          localJob.archivedFromStatus || localJob.status || "Quoted",
        archiveMeta,
        updatedAt: new Date().toISOString(),
      });
      navigate("JobStatusOverview");
    } catch (error) {
      console.error("Could not close job:", error);
      setCloseMessage("Could not save the close outcome.");
    } finally {
      setSavingClose(false);
    }
  }

  async function saveTodos(nextTodos, successMessage) {
    setSavingTodo(true);
    setTodoMessage("Saving TODOs...");

    try {
      await persistJob({
        ...localJob,
        todos: nextTodos,
        updatedAt: new Date().toISOString(),
      });
      setTodoMessage(successMessage);
    } catch (error) {
      console.error("Could not save TODOs:", error);
      setTodoMessage("Could not save TODOs.");
    } finally {
      setSavingTodo(false);
    }
  }

  async function addTodo(event) {
    event.preventDefault();
    const text = todoDraft.trim();
    if (!text || savingTodo) return;

    await saveTodos(
      [
        ...(Array.isArray(localJob.todos) ? localJob.todos : []),
        {
          id: makeTodoId(),
          text,
          highImportance: todoHigh,
          completed: false,
          createdAt: new Date().toISOString(),
        },
      ],
      "TODO added.",
    );
    setTodoDraft("");
    setTodoHigh(false);
  }

  function updateTodo(todoId, changes, successMessage) {
    const nextTodos = (Array.isArray(localJob.todos) ? localJob.todos : []).map(
      (todo) =>
        String(todo.id) === String(todoId)
          ? { ...todo, ...changes, updatedAt: new Date().toISOString() }
          : todo,
    );
    return saveTodos(nextTodos, successMessage);
  }

  function removeTodo(todoId) {
    const nextTodos = (Array.isArray(localJob.todos) ? localJob.todos : []).filter(
      (todo) => String(todo.id) !== String(todoId),
    );
    return saveTodos(nextTodos, "TODO removed.");
  }

  const quotes = localJob.quotes || [];
  const invoices = localJob.invoices || [];
  const payments = localJob.payments || [];
  const primaryQuote =
    quotes.find((quote) => quote.status === "accepted") ||
    quotes.find((quote) => ["issued", "emailed"].includes(quote.status)) ||
    quotes[quotes.length - 1];

  const contractValue = Number(
    localJob.contractValue ??
      localJob.quote?.total ??
      localJob.quoteTotal ??
      primaryQuote?.total ??
      0,
  );
  const invoicedTotal = invoices.reduce(
    (sum, invoice) =>
      sum + Number(invoice.total || invoice.grandTotal || invoice.invoiceTotal || 0),
    0,
  );
  const paymentTotal = payments.reduce(
    (sum, payment) =>
      sum + Number(payment.amount || payment.total || payment.value || 0),
    0,
  );
  const invoicePaidTotal = invoices.reduce(
    (sum, invoice) => sum + Number(invoice.paidAmount || 0),
    0,
  );
  const paidTotal = payments.length ? paymentTotal : invoicePaidTotal;
  const costTotal = Number(fileLinkedCost || 0);

  const jobTripLinks = tripLinks.filter(
    (link) => String(link.jobId) === String(localJob.id),
  );
  const sortedTripLinks = [...jobTripLinks].sort(
    (a, b) =>
      new Date(a.date || a.startTime || a.createdAt) -
      new Date(b.date || b.startTime || b.createdAt),
  );
  const visitDays = new Set(
    sortedTripLinks.map((link) =>
      new Date(link.date || link.startTime || link.createdAt).toDateString(),
    ),
  ).size;
  const totalMiles = jobTripLinks.reduce(
    (sum, link) =>
      sum + Number(link.miles || link.distanceMiles || link.totalMiles || 0),
    0,
  );
  const travelCost = totalMiles * TRAVEL_COST_PER_MILE;
  const estimatedProfit = contractValue - costTotal - travelCost;
  const earnedPerDay = visitDays > 0 ? (contractValue - costTotal) / visitDays : 0;
  const afterTravelPerDay =
    visitDays > 0 ? estimatedProfit / visitDays : 0;

  const firstVisit =
    sortedTripLinks[0]?.date ||
    sortedTripLinks[0]?.startTime ||
    sortedTripLinks[0]?.createdAt ||
    "";
  const lastVisit =
    sortedTripLinks[sortedTripLinks.length - 1]?.date ||
    sortedTripLinks[sortedTripLinks.length - 1]?.startTime ||
    sortedTripLinks[sortedTripLinks.length - 1]?.createdAt ||
    "";

  const mapCenter = hasCoordinates(localJob.location)
    ? [Number(localJob.location.lat), Number(localJob.location.lng)]
    : DEFAULT_CENTER;
  const recentActivity = buildRecentActivity(localJob);
  const status = localJob.status || (visitDays > 0 ? "In Progress" : "Not Started");
  const openTodos = (Array.isArray(localJob.todos) ? localJob.todos : []).filter(
    (todo) => !todo?.completed,
  );
  const highImportanceTodos = openTodos.filter(
    (todo) => todo.highImportance,
  ).length;
  const jobColour = getJobColour(isEditingJob ? editableJob : localJob);
  const sortedImmichPhotos = [...immichPhotos].sort((a, b) => {
    const aDate = a.fileCreatedAt || a.localDateTime || a.linkedAt || a.createdAt || 0;
    const bDate = b.fileCreatedAt || b.localDateTime || b.linkedAt || b.createdAt || 0;
    return new Date(bDate) - new Date(aDate);
  });
  const visibleImmichPhotos = showAllPhotos
    ? sortedImmichPhotos
    : sortedImmichPhotos.slice(0, 8);
  const automaticCoverAssetId = String(
    sortedImmichPhotos[0]?.assetId || sortedImmichPhotos[0]?.id || "",
  );
  const heroAssetId = String(
    localJob.coverImageAssetId || automaticCoverAssetId || "",
  );
  const heroMode = heroAssetId
    ? "cover"
    : hasCoordinates(localJob.location)
      ? "map"
      : "default";
  const referenceDocuments = (Array.isArray(jobFiles) ? jobFiles : [])
    .map((file) => {
      const matchingLinks = (Array.isArray(file.links) ? file.links : []).filter(
        (link) =>
          link.targetType === "job" &&
          String(link.targetId) === String(localJob.id) &&
          JOB_REFERENCE_CATEGORIES.has(
            String(link.category || "").trim().toLowerCase(),
          ),
      );

      if (!matchingLinks.length) return null;

      return {
        file,
        category: matchingLinks[0].category,
        note: matchingLinks.find((link) => link.note)?.note || "",
        date:
          file.purchaseDate ||
          file.dateSorted ||
          file.uploadedAt ||
          file.updatedAt ||
          "",
      };
    })
    .filter(Boolean)
    .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
  const visibleReferenceDocuments = referenceDocuments.slice(0, 6);
  const scheduleResourceMap = new Map(
    scheduleResources.map((resource) => [String(resource.id), resource]),
  );
  const todayDate = new Date().toISOString().slice(0, 10);
  const upcomingSchedule = scheduleEntries
    .filter((entry) => entry.status !== "cancelled" && entry.endDate >= todayDate)
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
  const assignedTeamNames = teamMembers
    .filter((member) => (localJob.assignedUserIds || []).map(String).includes(String(member.id)))
    .map((member) => member.displayName);

  function scheduledResourceNames(entry) {
    return [
      ...(entry.assignedPeople || []),
      ...(entry.assignedSubcontractors || []),
      ...(entry.assignedVehicles || []),
      ...(entry.assignedEquipment || []),
    ].map((id) => scheduleResourceMap.get(String(id))?.name).filter(Boolean);
  }

  return (
    <main
      className="jnrJobPage"
      ref={printRef}
      style={{ "--job-colour": jobColour }}
    >
      <section
        className={`jnrJobHeader jnrJobCard jnrJobHeader--${heroMode}`}
      >
        <div className="jnrJobHeroMedia" aria-hidden="true">
          {heroMode === "cover" ? (
            <img
              src={`${API_BASE}/api/immich/thumbnail/${encodeURIComponent(heroAssetId)}`}
              alt=""
            />
          ) : heroMode === "map" ? (
            <JobHeroMap location={localJob.location} />
          ) : (
            <div className="jnrJobHeroDefault">
              <img src={logo} alt="" />
              <span>JNR job file</span>
            </div>
          )}
        </div>

        <div className="jnrJobIdentity">
          <button
            type="button"
            className="jnrTextButton no-print"
            onClick={() => navigate("JobStatusOverview")}
          >
            ← Jobs
          </button>

          <div className="jnrJobTitleRow">
            <h1>{localJob.name || "Untitled job"}</h1>
            <span
              className={`jnrStatusPill ${statusTone(
                localJob.archived && localJob.archiveMeta?.type === "lost_quote"
                  ? "Lost"
                  : localJob.archived
                    ? "Closed"
                    : status,
              )}`}
            >
              {localJob.archived
                ? localJob.archiveMeta?.label || "Closed"
                : status}
            </span>
          </div>

          <p>{
            localJob.address ||
            localJob.location?.address ||
            "No site address saved"
          }</p>
        </div>

        <div className="jnrHeaderActions no-print">
          <button type="button" className="jnrButton quiet" onClick={printOverview}>
            Print
          </button>
          <button type="button" className="jnrButton primary" onClick={beginJobEdit}>
            Edit job
          </button>
          <button
            type="button"
            className="jnrButton archive"
            onClick={localJob.archived ? restoreJob : beginCloseJob}
            disabled={archiving || savingClose}
          >
            {archiving
              ? "Saving..."
              : localJob.archived
                ? "Restore job"
                : "Close job"}
          </button>
          {localJob.archived && !localJob.archiveMeta?.type && (
            <button
              type="button"
              className="jnrButton lost"
              onClick={beginCloseJob}
            >
              Classify outcome
            </button>
          )}
        </div>
      </section>

      {showCloseForm && (
        <section className="jnrJobCard jnrClosePanel no-print">
          <div className="jnrSectionHeading">
            <div>
              <h2>{localJob.archived ? "Classify closed job" : "Close job"}</h2>
              <p>
                Record why this left the live pipeline. Documents and VAT records stay attached.
              </p>
            </div>
            <span className="jnrCloseStage">
              Last live stage: {localJob.archivedFromStatus || status}
            </span>
          </div>

          <div className="jnrFormGrid">
            <label>
              <span>Outcome</span>
              <select
                value={closeOutcome}
                onChange={(event) => setCloseOutcome(event.target.value)}
              >
                {CLOSE_OUTCOME_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            {closeOutcome === "lost_quote" && (
              <>
                <label>
                  <span>Why was it lost?</span>
                  <select
                    value={lossReason}
                    onChange={(event) => setLossReason(event.target.value)}
                  >
                    {LOSS_REASON_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Your quote</span>
                  <input value={money(contractValue)} readOnly />
                </label>
                <label>
                  <span>Winning quote (optional)</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={winningQuote}
                    onChange={(event) => setWinningQuote(event.target.value)}
                    placeholder="e.g. 1950"
                  />
                </label>
              </>
            )}

            <label className="full">
              <span>What happened? (optional)</span>
              <textarea
                rows="3"
                value={closeNotes}
                onChange={(event) => setCloseNotes(event.target.value)}
                placeholder="Useful context for the next quote..."
              />
            </label>
          </div>

          {openTodos.length > 0 && (
            <p className="jnrCloseWarning">
              {openTodos.length} open TODO{openTodos.length === 1 ? "" : "s"} will be hidden from the live TODO count, but kept with the job.
            </p>
          )}
          {closeMessage && <p className="jnrFormMessage">{closeMessage}</p>}

          <div className="jnrButtonRow">
            <button
              type="button"
              className="jnrButton lost"
              onClick={closeJob}
              disabled={savingClose}
            >
              {savingClose
                ? "Saving..."
                : localJob.archived
                  ? "Save classification"
                  : "Close & store job"}
            </button>
            <button
              type="button"
              className="jnrButton quiet"
              onClick={() => setShowCloseForm(false)}
              disabled={savingClose}
            >
              Cancel
            </button>
          </div>
        </section>
      )}

      {localJob.archived && localJob.archiveMeta?.type && !showCloseForm && (
        <section className="jnrJobCard jnrOutcomeSummary">
          <div>
            <span>Outcome</span>
            <strong>{localJob.archiveMeta.label}</strong>
          </div>
          <div>
            <span>Reason</span>
            <strong>{localJob.archiveMeta.reasonLabel || "—"}</strong>
          </div>
          <div>
            <span>Winning quote</span>
            <strong>
              {localJob.archiveMeta.winningQuote === null ||
              localJob.archiveMeta.winningQuote === undefined
                ? "—"
                : money(localJob.archiveMeta.winningQuote)}
            </strong>
          </div>
          <div>
            <span>Closed</span>
            <strong>{formatDate(localJob.archiveMeta.archivedAt)}</strong>
          </div>
          {localJob.archiveMeta.notes && <p>{localJob.archiveMeta.notes}</p>}
        </section>
      )}

      {isEditingJob && (
        <section className="jnrJobCard jnrEditPanel no-print" ref={editPanelRef}>
          <div className="jnrSectionHeading">
            <div>
              <h2>Edit job</h2>
              <p>Update the job basics. The geofence is edited separately below.</p>
            </div>
          </div>

          <div className="jnrFormGrid">
            <label className="wide">
              <span>Job name</span>
              <input
                autoFocus
                value={editableJob.name || ""}
                onChange={(event) => updateEditableJob("name", event.target.value)}
              />
            </label>

            <label className="wide">
              <span>Site address</span>
              <input
                value={editableJob.siteAddress || ""}
                onChange={(event) =>
                  updateEditableJob("siteAddress", event.target.value)
                }
              />
            </label>

            <label>
              <span>Postcode</span>
              <input
                value={editableJob.postcode || ""}
                onChange={(event) =>
                  updateEditableJob("postcode", event.target.value.toUpperCase())
                }
                placeholder="LE13 1AA"
              />
            </label>

            <label>
              <span>Job type</span>
              <select
                value={editableJob.jobType || editableJob.type || "General building"}
                onChange={(event) => updateEditableJob("jobType", event.target.value)}
              >
                {JOB_TYPE_OPTIONS.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </label>

            <label>
              <span>Status</span>
              <select
                value={editableJob.status || "Not Started"}
                onChange={(event) => updateEditableJob("status", event.target.value)}
              >
                {[...new Set([...STATUS_OPTIONS, editableJob.status].filter(Boolean))].map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </label>

            <div className="jnrJobColourField full">
              <span>Job colour</span>
              <JobColourPicker
                value={editableJob.color || jobColour}
                onChange={(color) => updateEditableJob("color", color)}
                id="edit-job-colour"
              />
            </div>

            <label>
              <span>Start date</span>
              <input
                type="date"
                value={dateInputValue(editableJob.startDate)}
                onChange={(event) => updateEditableJob("startDate", event.target.value)}
              />
            </label>

            <label>
              <span>Target finish</span>
              <input
                type="date"
                min={dateInputValue(editableJob.startDate) || undefined}
                value={dateInputValue(editableJob.targetEndDate || editableJob.endDate)}
                onChange={(event) =>
                  updateEditableJob("targetEndDate", event.target.value)
                }
              />
            </label>

            <label>
              <span>Lead source</span>
              <select
                value={editableJob.source || editableJob.leadSource || ""}
                onChange={(event) => updateEditableJob("source", event.target.value)}
              >
                <option value="">Not recorded</option>
                {[...new Set([...SOURCE_OPTIONS, editableJob.source].filter(Boolean))].map(
                  (option) => (
                    <option key={option} value={option}>{option}</option>
                  ),
                )}
              </select>
            </label>

            <label className="full">
              <span>Notes</span>
              <textarea
                rows="4"
                value={editableJob.notes || ""}
                onChange={(event) => updateEditableJob("notes", event.target.value)}
              />
            </label>

            {currentUser?.role === "admin" && teamMembers.length > 0 && (
              <fieldset className="jnrAssignedTeam full">
                <legend>Assigned team · My Work access</legend>
                <p>
                  These people can see the job in their site workspace even before it is placed on the schedule.
                </p>
                <div>
                  {teamMembers.map((member) => {
                    const checked = (editableJob.assignedUserIds || []).map(String).includes(String(member.id));
                    return (
                      <label className={checked ? "selected" : ""} key={member.id}>
                        <input type="checkbox" checked={checked} onChange={() => toggleAssignedUser(member.id)} />
                        <span><strong>{member.displayName}</strong><small>@{member.username}</small></span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            )}
          </div>

          {jobMessage && <p className="jnrFormMessage">{jobMessage}</p>}

          <div className="jnrButtonRow">
            <button
              type="button"
              className="jnrButton success"
              onClick={saveJobDetails}
              disabled={savingJob}
            >
              {savingJob ? "Saving..." : "Save changes"}
            </button>
            <button
              type="button"
              className="jnrButton quiet"
              onClick={cancelEditJob}
              disabled={savingJob}
            >
              Cancel
            </button>
          </div>
        </section>
      )}

      {jobMessage && !isEditingJob && (
        <div className="jnrPageMessage" role="status">{jobMessage}</div>
      )}

      <section className="jnrMoneyStrip jnrJobCard" aria-label="Job financial summary">
        <Metric label="Contract value" value={money(contractValue)} />
        <Metric label="Invoiced" value={money(invoicedTotal)} />
        <Metric label="Paid" value={money(paidTotal)} tone="positive" />
        <Metric label="Costs" value={money(costTotal)} />
        <Metric
          label="Estimated profit"
          value={money(estimatedProfit)}
          tone={estimatedProfit >= 0 ? "positive" : "negative"}
        />
      </section>

      <section className="jnrShortcutGrid no-print" aria-label="Job shortcuts">
        <Shortcut
          title="TODOs"
          detail={
            openTodos.length
              ? `${openTodos.length} outstanding${highImportanceTodos ? ` · ${highImportanceTodos} high` : ""}`
              : "All clear · add a TODO"
          }
          onClick={() => navigate("TodoPage", { jobId: localJob.id })}
        />
        <Shortcut
          title="Costs & files"
          detail={`${fileCount} files · ${money(costTotal)}`}
          onClick={goToFiles}
        />
        <Shortcut
          title="Pricing notes"
          detail={
            pricingSummary.blockCount
              ? `${pricingSummary.blockCount} ${pricingSummary.blockCount === 1 ? "block" : "blocks"} · ${money(pricingSummary.workingTotalPence / 100)}`
              : "No pricing blocks yet"
          }
          onClick={() => navigate("PricingNotesPage", { jobId: localJob.id })}
        />
        <Shortcut
          title="Estimates & invoices"
          detail={`${quotes.length} estimates · ${invoices.length} invoices`}
          onClick={goToDocuments}
        />
        <Shortcut
          title="Visits & journeys"
          detail={`${visitDays} days · ${totalMiles.toFixed(1)} miles`}
          onClick={goToJourneys}
        />
        <Shortcut
          title="Recent photos"
          detail={`${immichPhotos.length} linked images`}
          onClick={showPhotos}
        />
      </section>

      {currentUser?.role === "admin" && (
        <section className="jnrJobCard jnrJobSchedule no-print">
          <div className="jnrSectionHeading">
            <div>
              <span className="jnrSectionKicker">Forward plan</span>
              <h2>Schedule</h2>
              <p>Upcoming attendance, people, vehicles and equipment allocated to this job.</p>
            </div>
            <button type="button" className="jnrButton primary" onClick={() => navigate("SchedulePage", { jobId: localJob.id })}>
              View in Schedule
            </button>
          </div>
          <div className="jnrJobScheduleList">
            {upcomingSchedule.slice(0, 4).map((entry) => {
              const names = scheduledResourceNames(entry);
              return (
                <article key={entry.id}>
                  <span className="jnrJobScheduleDate">
                    <strong>{formatDate(entry.startDate)}</strong>
                    <small>{entry.startDate === entry.endDate ? "One day" : `to ${formatDate(entry.endDate)}`}</small>
                  </span>
                  <span><strong>{names.length ? names.join(" · ") : "Resources not assigned"}</strong><small>{entry.note || "General attendance"}</small></span>
                  <span className={`jnrScheduleState ${entry.status}`}>{entry.status}</span>
                </article>
              );
            })}
            {!upcomingSchedule.length && (
              <button type="button" className="jnrScheduleEmpty" onClick={() => navigate("SchedulePage", { jobId: localJob.id })}>
                Nothing booked yet · add this job to the Schedule →
              </button>
            )}
          </div>
        </section>
      )}

      {referenceDocuments.length > 0 && (
        <section className="jnrJobCard jnrReferenceDocuments">
          <div className="jnrSectionHeading">
            <div>
              <span className="jnrSectionKicker">Plans &amp; records</span>
              <h2>Job documents</h2>
              <p>
                Drawings, certificates and supporting documents kept with this
                job—not included as costs.
              </p>
            </div>
            <div className="jnrReferenceHeadingActions no-print">
              <strong>
                {referenceDocuments.length}{" "}
                {referenceDocuments.length === 1 ? "document" : "documents"}
              </strong>
              <button type="button" className="jnrButton primary" onClick={goToFiles}>
                Open all files
              </button>
            </div>
          </div>

          <div className="jnrReferenceGrid">
            {visibleReferenceDocuments.map(({ file, category, note, date }) => {
              const name = fileName(file);
              const url = fileUrl(file);
              const extension = fileExtension(file);
              const isPdf = extension === "pdf";
              const isImage = ["jpg", "jpeg", "png", "webp", "gif"].includes(
                extension,
              );

              return (
                <article className="jnrReferenceDocument" key={file.id || name}>
                  <div className="jnrReferencePreview">
                    {url && isPdf ? (
                      <iframe
                        src={`${url}#page=1&view=FitH`}
                        title={`Preview ${name}`}
                        loading="lazy"
                      />
                    ) : url && isImage ? (
                      <img src={url} alt="" loading="lazy" />
                    ) : (
                      <div className="jnrReferenceFallback">
                        <span>{extension.slice(0, 4).toUpperCase()}</span>
                      </div>
                    )}
                  </div>
                  <div className="jnrReferenceCopy">
                    <span>{referenceCategoryLabel(category)}</span>
                    <strong title={name}>{name}</strong>
                    <small>{note || `Added ${formatDate(date)}`}</small>
                  </div>
                  {url ? (
                    <a href={url} target="_blank" rel="noreferrer">
                      Open original ↗
                    </a>
                  ) : (
                    <span className="jnrReferenceUnavailable">Original unavailable</span>
                  )}
                </article>
              );
            })}
          </div>

          {referenceDocuments.length > visibleReferenceDocuments.length && (
            <button
              type="button"
              className="jnrTextButton jnrReferenceMore no-print"
              onClick={goToFiles}
            >
              View all {referenceDocuments.length} job documents →
            </button>
          )}
        </section>
      )}

      <section className="jnrJobCard jnrTodoCard no-print">
        <div className="jnrSectionHeading compact">
          <div>
            <h2>Job TODOs</h2>
            <p>
              {openTodos.length
                ? `${openTodos.length} action${openTodos.length === 1 ? "" : "s"} outstanding`
                : "Nothing is waiting on this job."}
            </p>
          </div>
          <button
            type="button"
            className="jnrTextButton"
            onClick={() => navigate("TodoPage", { jobId: localJob.id })}
          >
            Open full TODO board →
          </button>
        </div>

        <form className="jnrTodoComposer" onSubmit={addTodo}>
          <input
            value={todoDraft}
            onChange={(event) => setTodoDraft(event.target.value)}
            placeholder="Add a clear next action..."
            disabled={savingTodo || localJob.archived}
          />
          <label className={todoHigh ? "selected" : ""}>
            <input
              type="checkbox"
              checked={todoHigh}
              onChange={(event) => setTodoHigh(event.target.checked)}
              disabled={savingTodo || localJob.archived}
            />
            High importance
          </label>
          <button
            type="submit"
            className="jnrButton primary"
            disabled={!todoDraft.trim() || savingTodo || localJob.archived}
          >
            Add TODO
          </button>
        </form>

        {openTodos.length ? (
          <div className="jnrInlineTodoList">
            {openTodos.map((todo) => (
              <article
                key={todo.id}
                className={`jnrInlineTodo ${todo.highImportance ? "high" : ""}`}
              >
                <button
                  type="button"
                  className="jnrTodoCheck"
                  onClick={() =>
                    updateTodo(todo.id, { completed: true }, "TODO completed.")
                  }
                  disabled={savingTodo || localJob.archived}
                  title="Mark complete"
                >
                  ✓
                </button>
                <strong>{todo.text}</strong>
                <button
                  type="button"
                  className={`jnrTodoPriority ${todo.highImportance ? "active" : ""}`}
                  onClick={() =>
                    updateTodo(
                      todo.id,
                      { highImportance: !todo.highImportance },
                      todo.highImportance
                        ? "High importance removed."
                        : "Marked high importance.",
                    )
                  }
                  disabled={savingTodo || localJob.archived}
                  title="Toggle high importance"
                >
                  !
                </button>
                <button
                  type="button"
                  className="jnrTodoDelete"
                  onClick={() => removeTodo(todo.id)}
                  disabled={savingTodo || localJob.archived}
                  title="Delete TODO"
                >
                  Remove
                </button>
              </article>
            ))}
          </div>
        ) : (
          <div className="jnrTodoClear">✓ All clear</div>
        )}
        {localJob.archived && (
          <p className="jnrFormMessage">Restore this job before changing its TODOs.</p>
        )}
        {todoMessage && <p className="jnrFormMessage">{todoMessage}</p>}
      </section>

      <section className="jnrJobContentGrid">
        <aside className="jnrContentStack">
          <section className="jnrJobCard jnrClientCard">
            <div className="jnrSectionHeading compact">
              <h2>Client</h2>
              {!editingCustomer && (
                <button
                  type="button"
                  className="jnrTextButton no-print"
                  onClick={() => setEditingCustomer(true)}
                >
                  Edit
                </button>
              )}
            </div>

            {editingCustomer ? (
              <div className="jnrClientForm no-print">
                <label>
                  <span>Name</span>
                  <input
                    value={customerDetails.name}
                    onChange={(event) =>
                      setCustomerDetails((current) => ({
                        ...current,
                        name: event.target.value,
                      }))
                    }
                  />
                </label>
                <label>
                  <span>Phone</span>
                  <input
                    value={customerDetails.phone}
                    onChange={(event) =>
                      setCustomerDetails((current) => ({
                        ...current,
                        phone: event.target.value,
                      }))
                    }
                  />
                </label>
                <label>
                  <span>Email</span>
                  <input
                    type="email"
                    value={customerDetails.email}
                    onChange={(event) =>
                      setCustomerDetails((current) => ({
                        ...current,
                        email: event.target.value,
                      }))
                    }
                  />
                </label>
                <label>
                  <span>Address</span>
                  <textarea
                    rows="3"
                    value={customerDetails.address}
                    onChange={(event) =>
                      setCustomerDetails((current) => ({
                        ...current,
                        address: event.target.value,
                      }))
                    }
                  />
                </label>

                {customerMessage && (
                  <p className="jnrFormMessage">{customerMessage}</p>
                )}

                <div className="jnrButtonRow">
                  <button
                    type="button"
                    className="jnrButton success"
                    onClick={saveCustomerDetails}
                    disabled={savingCustomer}
                  >
                    {savingCustomer ? "Saving..." : "Save"}
                  </button>
                  <button
                    type="button"
                    className="jnrButton quiet"
                    onClick={cancelCustomerEdit}
                    disabled={savingCustomer}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="jnrClientDetails">
                <strong>
                  {localJob.customerDetails?.name || localJob.clientName || "No client saved"}
                </strong>
                <ContactLine
                  label="Phone"
                  value={localJob.customerDetails?.phone || localJob.clientPhone}
                  href={
                    localJob.customerDetails?.phone || localJob.clientPhone
                      ? `tel:${localJob.customerDetails?.phone || localJob.clientPhone}`
                      : ""
                  }
                />
                <ContactLine
                  label="Email"
                  value={localJob.customerDetails?.email || localJob.clientEmail}
                  href={
                    localJob.customerDetails?.email || localJob.clientEmail
                      ? `mailto:${localJob.customerDetails?.email || localJob.clientEmail}`
                      : ""
                  }
                />
                <ContactLine
                  label="Address"
                  value={localJob.customerDetails?.address}
                />
                {customerMessage && (
                  <p className="jnrFormMessage">{customerMessage}</p>
                )}
              </div>
            )}
          </section>

          <section className="jnrJobCard jnrNotesCard">
            <div className="jnrSectionHeading compact">
              <h2>Notes</h2>
              <button
                type="button"
                className="jnrTextButton no-print"
                onClick={beginJobEdit}
              >
                Edit
              </button>
            </div>
            <p>{localJob.notes || "No notes added yet."}</p>
          </section>
        </aside>

        <section className="jnrJobCard jnrGeofenceCard">
          <div className="jnrSectionHeading">
            <div>
              <h2>Location & Geofence</h2>
              <p>Search the address or click the map to refine the job pin.</p>
            </div>
          </div>

          <div className="jnrGeofenceSearch no-print">
            <input
              value={localJob.location?.address || localJob.address || ""}
              onChange={(event) => updateLocation({ address: event.target.value })}
              placeholder="Search address..."
            />
            <button type="button" className="jnrButton primary" onClick={geocodeAddress}>
              Search address
            </button>
          </div>

          <div className="jnrJobMap">
            <MapContainer center={mapCenter} zoom={15}>
              <TileLayer
                attribution="&copy; OpenStreetMap"
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <FlyToLocation location={localJob.location} />
              <JobPinPicker
                location={localJob.location}
                onPick={(point) =>
                  updateLocation({
                    ...point,
                    radiusMeters: Number(localJob.location?.radiusMeters || 150),
                    address: localJob.location?.address || localJob.address || "",
                  })
                }
              />
            </MapContainer>
          </div>

          <div className="jnrGeoInfoGrid">
            <InfoBox
              title="Latitude"
              value={
                hasCoordinates(localJob.location)
                  ? Number(localJob.location.lat).toFixed(6)
                  : "—"
              }
            />
            <InfoBox
              title="Longitude"
              value={
                hasCoordinates(localJob.location)
                  ? Number(localJob.location.lng).toFixed(6)
                  : "—"
              }
            />
            <label className="jnrRadiusField">
              <span>Radius</span>
              <div>
                <input
                  type="number"
                  min="25"
                  step="25"
                  value={Number(localJob.location?.radiusMeters || 150)}
                  onChange={(event) =>
                    updateLocation({ radiusMeters: Number(event.target.value || 150) })
                  }
                />
                <small>m</small>
              </div>
            </label>
            <InfoBox
              title="Geofence"
              value={hasCoordinates(localJob.location) ? "Active" : "Not set"}
              tone={hasCoordinates(localJob.location) ? "positive" : ""}
            />
          </div>

          <div className="jnrGeofenceFooter no-print">
            <span role="status">{locationMessage}</span>
            <button
              type="button"
              className="jnrButton success"
              onClick={saveJobLocation}
              disabled={savingLocation}
            >
              {savingLocation ? "Saving..." : "Save geofence"}
            </button>
          </div>
        </section>

        <aside className="jnrContentStack">
          <section className="jnrJobCard">
            <div className="jnrSectionHeading compact">
              <h2>Job details</h2>
              <button
                type="button"
                className="jnrTextButton no-print"
                onClick={beginJobEdit}
              >
                Edit
              </button>
            </div>
            {(!(localJob.jobType || localJob.type) ||
              !localJob.startDate ||
              !(localJob.targetEndDate || localJob.endDate) ||
              !(localJob.source || localJob.leadSource)) && (
              <button
                type="button"
                className="jnrMissingDetails no-print"
                onClick={beginJobEdit}
              >
                Complete missing job details →
              </button>
            )}
            <SideRow label="Job type" value={localJob.jobType || localJob.type || "—"} />
            <SideRow label="Start date" value={formatDate(localJob.startDate)} />
            <SideRow
              label="Target finish"
              value={formatDate(localJob.targetEndDate || localJob.endDate)}
            />
            <SideRow label="Lead source" value={localJob.source || localJob.leadSource || "—"} />
            <SideRow label="Assigned team" value={assignedTeamNames.length ? assignedTeamNames.join(", ") : "—"} />
            <SideRow label="Files" value={fileCount} />
            <SideRow label="Photos" value={immichPhotos.length} />
          </section>

          <section className="jnrJobCard">
            <h2>Visit summary</h2>
            <SideRow label="First visit" value={formatDate(firstVisit)} />
            <SideRow label="Last visit" value={formatDate(lastVisit)} />
            <SideRow label="Days attended" value={`${visitDays} days`} />
            <SideRow label="Total miles" value={`${totalMiles.toFixed(1)} miles`} />
            <SideRow
              label="Average miles / day"
              value={visitDays ? `${(totalMiles / visitDays).toFixed(1)} miles` : "0 miles"}
            />
          </section>

          <section className="jnrJobCard">
            <h2>Performance</h2>
            <SideRow label="Earned per day" value={money(earnedPerDay)} />
            <SideRow label="After travel / day" value={money(afterTravelPerDay)} />
            <SideRow label="Callum days" value={`${localJob.callumDays || 0} days`} />
            <SideRow
              label="Labour remaining"
              value={money(localJob.labourRemaining || 0)}
            />
          </section>

          <section className="jnrJobCard">
            <h2>Recent activity</h2>
            {recentActivity.length ? (
              <div className="jnrActivityList">
                {recentActivity.map((activity, index) => (
                  <div className="jnrActivityItem" key={`${activity.label}-${index}`}>
                    <span aria-hidden="true" />
                    <strong>{activity.label}</strong>
                    <small>{formatActivityDate(activity.date)}</small>
                  </div>
                ))}
              </div>
            ) : (
              <p className="jnrEmptyText">No activity recorded yet.</p>
            )}
          </section>
        </aside>
      </section>

      <section className="jnrJobCard jnrPhotosCard" ref={photosRef}>
        <div className="jnrSectionHeading">
          <div>
            <h2>Job photos &amp; homepage cover</h2>
            <p>
              Choose a linked Immich photo for this job's homepage slide, or
              mark a personal or unrelated image as Not this job.
            </p>
          </div>
          <div className="jnrPhotoHeadingActions no-print">
            <strong>{immichPhotos.length} linked</strong>
            <button
              type="button"
              className="jnrButton primary"
              onClick={() => refreshImmichPhotos(localJob.id, true)}
              disabled={refreshingPhotos}
            >
              {refreshingPhotos ? "Checking..." : "Refresh photos"}
            </button>
            {localJob.coverImageAssetId && (
              <button
                type="button"
                className="jnrButton quiet"
                onClick={() => selectCoverImage(null)}
                disabled={Boolean(savingCoverId)}
              >
                {savingCoverId === "automatic" ? "Saving..." : "Use newest automatically"}
              </button>
            )}
          </div>
        </div>

        {photoMessage && (
          <p
            className={`jnrPhotoMessage ${
              photoMessage.startsWith("Could not") ? "error" : ""
            }`}
          >
            {photoMessage}
          </p>
        )}

        {immichPhotos.length ? (
          <>
            <div className="jnrPhotoGrid">
              {visibleImmichPhotos.map((photo) => {
                const assetId = String(photo.assetId || photo.id || "");
                const isCover =
                  assetId && String(localJob.coverImageAssetId || "") === assetId;

                return (
                  <article
                    className={`jnrPhotoChoice ${isCover ? "isCover" : ""}`}
                    key={assetId || photo.originalFileName}
                  >
                    <button
                      type="button"
                      className="jnrPhotoCoverAction"
                      onClick={() => selectCoverImage(assetId)}
                      disabled={
                        !assetId ||
                        Boolean(savingCoverId) ||
                        removingPhotoId === assetId
                      }
                      aria-pressed={Boolean(isCover)}
                      title={
                        isCover ? "Current homepage cover" : "Use as homepage cover"
                      }
                    >
                      <img
                        src={`${API_BASE}/api/immich/thumbnail/${encodeURIComponent(assetId)}`}
                        alt={photo.originalFileName || "Job photo"}
                        loading="lazy"
                      />
                      <span>
                        {savingCoverId === assetId
                          ? "Saving..."
                          : isCover
                            ? "Homepage cover"
                            : "Set as cover"}
                      </span>
                    </button>
                    <button
                      type="button"
                      className="jnrPhotoReject no-print"
                      onClick={() => excludePhoto(assetId)}
                      disabled={!assetId || Boolean(removingPhotoId)}
                      title="Remove from this job without deleting from Immich"
                    >
                      {removingPhotoId === assetId
                        ? "Removing..."
                        : "Not this job"}
                    </button>
                  </article>
                );
              })}
            </div>

            <div className="jnrPhotoFooter no-print">
              <p className={coverMessage.startsWith("Could not") ? "error" : ""}>
                {coverMessage ||
                  (localJob.coverImageAssetId
                    ? "Your chosen cover stays fixed until you change it."
                    : "Automatic mode uses the newest accepted linked Immich photo.")}
              </p>
              {sortedImmichPhotos.length > 8 && (
                <button
                  type="button"
                  className="jnrTextButton"
                  onClick={() => setShowAllPhotos((current) => !current)}
                >
                  {showAllPhotos
                    ? "Show latest 8"
                    : `Show all ${sortedImmichPhotos.length} photos`}
                </button>
              )}
            </div>
          </>
        ) : (
          <div className="jnrEmptyBox">
            Photos will appear here once Immich links them to the job.
          </div>
        )}
      </section>

      <section className="printOnly jnrPrintReport">
        <div className="jnrPrintHeader">
          <img src={logo} alt="JNR logo" />
          <div>
            <h1>Job overview</h1>
            <p>Generated {formatDate(new Date())}</p>
          </div>
        </div>

        <h2>{localJob.name}</h2>
        <p>{localJob.address || localJob.location?.address}</p>

        <div className="jnrPrintGrid">
          <InfoBox title="Contract value" value={money(contractValue)} />
          <InfoBox title="Invoiced" value={money(invoicedTotal)} />
          <InfoBox title="Paid" value={money(paidTotal)} />
          <InfoBox title="Costs" value={money(costTotal)} />
          <InfoBox title="Estimated profit" value={money(estimatedProfit)} />
          <InfoBox title="Days attended" value={visitDays} />
        </div>

        <h3>Client</h3>
        <p>{localJob.customerDetails?.name || "No client saved."}</p>

        <h3>Notes</h3>
        <p>{localJob.notes || "No notes added."}</p>
      </section>
    </main>
  );
}

function Metric({ label, value, tone = "" }) {
  return (
    <div className={`jnrMetric ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Shortcut({ title, detail, onClick }) {
  return (
    <button type="button" className="jnrShortcut jnrJobCard" onClick={onClick}>
      <span>
        <strong>{title}</strong>
        <small>{detail}</small>
      </span>
      <b aria-hidden="true">›</b>
    </button>
  );
}

function ContactLine({ label, value, href = "" }) {
  return (
    <div className="jnrContactLine">
      <span>{label}</span>
      {href && value ? <a href={href}>{value}</a> : <strong>{value || "—"}</strong>}
    </div>
  );
}

function SideRow({ label, value }) {
  return (
    <div className="jnrSideRow">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function InfoBox({ title, value, tone = "" }) {
  return (
    <div className={`jnrInfoBox ${tone}`}>
      <span>{title}</span>
      <strong>{value}</strong>
    </div>
  );
}

export default JobOverview;
