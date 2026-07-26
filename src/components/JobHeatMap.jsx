import { useEffect, useMemo, useState } from "react";
import jsPDF from "jspdf";
import {
  MapContainer,
  TileLayer,
  Polyline,
  Circle,
  CircleMarker,
  Marker,
  Popup,
  Tooltip,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import jnrLogo from "../assets/logo.png";

const API_BASE = "";
const DEFAULT_CENTER = [52.7689, -0.9007];
const MILEAGE_RATE = 1.8;

const TRIP_PURPOSES = [
  { value: "job_visit", label: "Job visit / commute" },
  { value: "materials", label: "Materials" },
  { value: "quoting", label: "Quoting / survey" },
  { value: "waste_run", label: "Waste run" },
  { value: "supplier", label: "Supplier / merchant" },
  { value: "fuel", label: "Fuel" },
  { value: "break_lunch", label: "Break / Lunch" },
  { value: "personal", label: "Personal" },
  { value: "ignore", label: "Ignore" },
];

function todayInput() {
  return new Date().toISOString().slice(0, 10);
}

function addDays(dateString, amount) {
  const date = new Date(`${dateString}T00:00:00`);
  date.setDate(date.getDate() + amount);
  return date.toISOString().slice(0, 10);
}

function getCalendarDays(centerDate) {
  const days = [];

  for (let i = -6; i <= 7; i++) {
    const date = addDays(centerDate, i);
    const d = new Date(`${date}T00:00:00`);

    days.push({
      date,
      dayNumber: d.getDate(),
      weekday: d.toLocaleDateString("en-GB", { weekday: "short" }),
      isToday: date === todayInput(),
    });
  }

  return days;
}

function getLatLng(point) {
  if (!point) return null;
  if (Array.isArray(point)) return [Number(point[0]), Number(point[1])];

  const lat = Number(point.latitude ?? point.lat);
  const lng = Number(point.longitude ?? point.lng ?? point.lon);

  return Number.isFinite(lat) && Number.isFinite(lng) ? [lat, lng] : null;
}

function metresToMiles(metres) {
  return Number(metres || 0) / 1609.344;
}

function formatMiles(value) {
  return `${Number(value || 0).toFixed(1)} mi`;
}

function formatMoney(value) {
  return `£${Number(value || 0).toFixed(2)}`;
}

function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function formatDuration(start, end) {
  if (!start || !end) return "—";

  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (!Number.isFinite(ms) || ms <= 0) return "—";

  const totalMinutes = Math.round(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (!hours) return `${minutes} mins`;
  if (!minutes) return `${hours} hr${hours === 1 ? "" : "s"}`;
  return `${hours} hr${hours === 1 ? "" : "s"} ${minutes} mins`;
}

function formatCoords(coords) {
  if (!coords) return "—";
  return `${Number(coords[0]).toFixed(6)}, ${Number(coords[1]).toFixed(6)}`;
}

function googleMapsUrl(coords) {
  if (!coords) return "#";
  return `https://www.google.com/maps/search/?api=1&query=${coords[0]},${coords[1]}`;
}

function addressCacheKey(coords) {
  if (!coords) return "";
  return `${Number(coords[0]).toFixed(6)},${Number(coords[1]).toFixed(6)}`;
}

function getCachedAddress(coords) {
  try {
    const cache = JSON.parse(localStorage.getItem("jnr-address-cache") || "{}");
    return cache[addressCacheKey(coords)] || null;
  } catch {
    return null;
  }
}

function setCachedAddress(coords, address) {
  try {
    const cache = JSON.parse(localStorage.getItem("jnr-address-cache") || "{}");
    cache[addressCacheKey(coords)] = address;
    localStorage.setItem("jnr-address-cache", JSON.stringify(cache));
  } catch {
    // ignore localStorage issues
  }
}

async function reverseGeocode(coords) {
  if (!coords) return null;

  const cached = getCachedAddress(coords);
  if (cached) return cached;

  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${coords[0]}&lon=${coords[1]}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });

  if (!res.ok) throw new Error("Could not resolve address");

  const data = await res.json();
  const address = {
    displayName: data.display_name || "Unknown address",
    road: data.address?.road || "",
    suburb: data.address?.suburb || "",
    town:
      data.address?.town ||
      data.address?.city ||
      data.address?.village ||
      data.address?.hamlet ||
      "",
    county: data.address?.county || "",
    postcode: data.address?.postcode || "",
    country: data.address?.country || "",
  };

  setCachedAddress(coords, address);
  return address;
}

function shortAddress(address) {
  if (!address) return "Resolving address...";

  const parts = [
    address.road,
    address.suburb,
    address.town,
    address.county,
    address.postcode,
    address.country,
  ].filter(Boolean);

  return parts.length ? parts.join(", ") : address.displayName;
}

function formatTime(value) {
  if (!value) return "—";
  return new Date(value).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDateTime(value) {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function distanceMeters(a, b) {
  const R = 6371000;
  const lat1 = (Number(a[0]) * Math.PI) / 180;
  const lat2 = (Number(b[0]) * Math.PI) / 180;
  const dLat = ((Number(b[0]) - Number(a[0])) * Math.PI) / 180;
  const dLng = ((Number(b[1]) - Number(a[1])) * Math.PI) / 180;

  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return 2 * R * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function normaliseTrip(trip, index) {
  const rawPoints = Array.isArray(trip.rawPoints) ? trip.rawPoints : [];

  const line = Array.isArray(trip.line)
    ? trip.line.map(getLatLng).filter(Boolean)
    : rawPoints.map(getLatLng).filter(Boolean);

  const first = rawPoints[0];
  const last = rawPoints[rawPoints.length - 1];

  const startDistance = Number(first?.attributes?.totalDistance || 0);
  const endDistance = Number(last?.attributes?.totalDistance || 0);

  const calculatedMiles =
    endDistance > startDistance
      ? metresToMiles(endDistance - startDistance)
      : 0;

  return {
    id: trip.id ?? trip.tripId ?? index + 1,
    displayNumber: index + 1,
    line,
    start: line[0],
    end: line[line.length - 1],
    startTime:
      trip.startTime ||
      first?.fixTime ||
      first?.deviceTime ||
      first?.serverTime,
    endTime:
      trip.endTime || last?.fixTime || last?.deviceTime || last?.serverTime,
    miles: Number(trip.distanceMiles || trip.miles || calculatedMiles || 0),
    rawPointCount: rawPoints.length,
    raw: trip,
  };
}

function FitMap({ points, selectedTripId }) {
  const map = useMap();

  useEffect(() => {
    setTimeout(() => {
      map.invalidateSize();

      const clean = points.filter(Boolean);

      if (clean.length) {
        map.fitBounds(L.latLngBounds(clean), {
          padding: [55, 55],
          maxZoom: selectedTripId ? 16 : 14,
        });
      }
    }, 150);
  }, [map, points, selectedTripId]);

  return null;
}

function makeDirectionIcon() {
  return L.divIcon({
    className: "directionArrowIcon",
    html: "➜",
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });
}

function getMiddlePoint(line) {
  if (!line?.length) return null;
  return line[Math.floor(line.length / 2)];
}

async function imageToDataUrl(src) {
  const response = await fetch(src);
  const blob = await response.blob();

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function generateTripReportPdf({
  trip,
  startAddress,
  endAddress,
  viewingDate,
}) {
  if (!trip) return;

  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;
  const cardW = pageWidth - margin * 2;
  let y = 16;

  const duration = formatDuration(trip.startTime, trip.endTime);
  const mileageCharge = formatMoney(trip.miles * MILEAGE_RATE);
  const reportId = `${String(viewingDate || todayInput()).replaceAll(
    "-",
    "",
  )}-TRIP-${trip.displayNumber}`;

  let logo = null;

  try {
    logo = await imageToDataUrl(jnrLogo);
  } catch (err) {
    console.warn("Logo could not be loaded for PDF", err);
  }

  // Header
  doc.setFillColor(0, 0, 0);
  doc.rect(0, 0, pageWidth, 48, "F");

  if (logo) {
    doc.addImage(logo, "PNG", margin, 9, 30, 30);
  }

  const titleX = logo ? 50 : margin;

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("JNR Plastering & Building", titleX, y);

  y += 9;
  doc.setFontSize(14);
  doc.text("Journey Summary", titleX, y);

  y += 7;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(203, 213, 225);
  doc.text("Generated from JNR Job Tracker", titleX, y);

  y += 6;
  doc.setFontSize(8);
  doc.text(`Report ID: ${reportId}`, titleX, y);

  // Journey summary card
  y = 60;

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, y, cardW, 76, 4, 4, "FD");

  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("Journey Details", margin + 5, y + 11);

  const metrics = [
    ["Trip", `Trip ${trip.displayNumber}`],
    ["Date", formatDate(viewingDate || trip.startTime)],
    ["Start Time", formatTime(trip.startTime)],
    ["End Time", formatTime(trip.endTime)],
    ["Duration", duration],
    ["Distance", formatMiles(trip.miles)],
    ["Mileage Charge", mileageCharge],
    ["GPS Points", String(trip.rawPointCount || trip.line.length)],
  ];

  metrics.forEach(([label, value], index) => {
    const col = index % 2;
    const row = Math.floor(index / 2);

    const cellX = margin + 5 + col * 90;
    const cellY = y + 26 + row * 11;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(label, cellX, cellY);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text(String(value), cellX, cellY + 5);
  });

  // Start card
  y += 90;

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, y, cardW, 58, 4, 4, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(15, 23, 42);
  doc.text("Journey Started", margin + 5, y + 11);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(51, 65, 85);
  doc.text(
    doc.splitTextToSize(shortAddress(startAddress), cardW - 10),
    margin + 5,
    y + 20,
  );

  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42);
  doc.text("Coordinates", margin + 5, y + 43);

  doc.setFont("helvetica", "normal");
  doc.text(formatCoords(trip.start), margin + 5, y + 50);

  // End card
  y += 72;

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, y, cardW, 58, 4, 4, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(15, 23, 42);
  doc.text("Journey Ended", margin + 5, y + 11);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(51, 65, 85);
  doc.text(
    doc.splitTextToSize(shortAddress(endAddress), cardW - 10),
    margin + 5,
    y + 20,
  );

  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42);
  doc.text("Coordinates", margin + 5, y + 43);

  doc.setFont("helvetica", "normal");
  doc.text(formatCoords(trip.end), margin + 5, y + 50);

  // Footer statement
  y += 76;

  doc.setDrawColor(226, 232, 240);
  doc.line(margin, y, pageWidth - margin, y);

  y += 8;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(
    doc.splitTextToSize(
      "This journey summary was automatically generated using GPS data recorded by the JNR Job Tracker system. It summarises the selected journey, including time, mileage, start location and end location.",
      cardW,
    ),
    margin,
    y,
  );

  doc.save(`Journey-Summary-${viewingDate}-Trip-${trip.displayNumber}.pdf`);
}

function TripLocationCard({ title, coords, address, loading }) {
  async function copyCoords() {
    if (!coords) return;
    await navigator.clipboard.writeText(`${coords[0]}, ${coords[1]}`);
  }

  return (
    <div className="locationCard">
      <span className="locationLabel">{title}</span>
      <strong>
        {loading ? "Resolving address..." : shortAddress(address)}
      </strong>
      <p className="muted coordinateText">{formatCoords(coords)}</p>
      <div className="locationActions">
        <button type="button" onClick={copyCoords}>
          Copy Coordinates
        </button>
        <a href={googleMapsUrl(coords)} target="_blank" rel="noreferrer">
          Open In Maps
        </a>
      </div>
    </div>
  );
}

function TripAllocationPanel({
  trip,
  jobs,
  suggestions = [],
  existingLink,
  allocating,
  onSave,
}) {
  const suggestedJobId = suggestions[0]?.jobId || "";

  const [jobId, setJobId] = useState(
    existingLink?.jobId || suggestedJobId || "no-job",
  );

  const [purpose, setPurpose] = useState(existingLink?.type || "job_visit");
  const [note, setNote] = useState(existingLink?.note || "");

  useEffect(() => {
    setJobId(existingLink?.jobId || suggestedJobId || "no-job");
    setPurpose(existingLink?.type || "job_visit");
    setNote(existingLink?.note || "");
  }, [trip?.id, existingLink, suggestedJobId]);

  if (!trip) {
    return <p className="muted">Select a trip from the left.</p>;
  }

  const selectedJob = jobs.find((job) => String(job.id) === String(jobId));

  function saveAllocation() {
    const hasJob = jobId !== "no-job";

    onSave({
      trip,
      type: purpose,
      jobId: hasJob ? jobId : null,
      jobName: hasJob
        ? selectedJob?.name || selectedJob?.address || `Job ${jobId}`
        : "No Job Link",
      note,
    });
  }

  function disregardTrip() {
    onSave({
      trip,
      type: "ignore",
      jobId: null,
      jobName: "No Job Link",
      note: note || "Disregarded trip.",
    });
  }

  return (
    <div className="allocationPanel">
      <div>
        <h2>Allocate Trip {trip.displayNumber}</h2>
        <p className="muted">Choose the job, purpose, then save.</p>
      </div>

      {existingLink && (
        <div className="allocationExisting">
          <strong>Currently allocated</strong>
          <p className="muted">
            {existingLink.type} · {existingLink.jobName || "No Job Link"}
          </p>
        </div>
      )}

      {suggestions.length > 0 && (
        <div className="suggestionCard">
          <strong>Suggested from geofence</strong>

          {suggestions.map((suggestion) => (
            <p className="muted" key={suggestion.jobId}>
              {suggestion.jobName} · {Math.round(suggestion.distanceMeters)}m
              from pin
            </p>
          ))}
        </div>
      )}

      <label className="allocationField">
        <span>What job was this trip in relation to?</span>

        <select
          value={jobId}
          onChange={(event) => setJobId(event.target.value)}
        >
          <option value="no-job">No Job Link</option>

          {jobs.map((job) => (
            <option key={job.id} value={job.id}>
              {job.name || job.address || `Job ${job.id}`}
            </option>
          ))}
        </select>
      </label>

      <label className="allocationField">
        <span>What was the trip for?</span>

        <select
          value={purpose}
          onChange={(event) => setPurpose(event.target.value)}
        >
          {TRIP_PURPOSES.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </label>

      <label className="allocationField">
        <span>Note / place</span>

        <input
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="e.g. Screwfix bits, tip run, lunch..."
        />
      </label>

      <div className="allocationActions">
        <button
          className="successButton"
          disabled={allocating}
          onClick={saveAllocation}
        >
          {allocating
            ? "Saving..."
            : existingLink
              ? "Update Allocation"
              : "Save Allocation"}
        </button>

        <button
          className="dangerButton"
          disabled={allocating}
          onClick={disregardTrip}
        >
          {allocating ? "Saving..." : "Disregard Trip"}
        </button>
      </div>
    </div>
  );
}

export default function JobHeatMap({ jobs = [] }) {
  const [date, setDate] = useState(todayInput());
  const [viewingDate, setViewingDate] = useState(todayInput());
  const [trips, setTrips] = useState([]);
  const [links, setLinks] = useState([]);
  const [allLinks, setAllLinks] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [selectedTripId, setSelectedTripId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [allocatingTripId, setAllocatingTripId] = useState(null);
  const [error, setError] = useState("");
  const [startAddress, setStartAddress] = useState(null);
  const [endAddress, setEndAddress] = useState(null);
  const [addressLoading, setAddressLoading] = useState(false);
  const [addressError, setAddressError] = useState("");

  const selectedTrip = trips.find(
    (trip) => String(trip.id) === String(selectedTripId),
  );

  const selectedTripLink = selectedTrip ? getTripLink(selectedTrip.id) : null;

  const visibleTrips = selectedTrip ? [selectedTrip] : trips;

  const allocatedDates = useMemo(() => {
    return new Set(allLinks.map((link) => link.date).filter(Boolean));
  }, [allLinks]);

  const calendarDays = useMemo(() => {
    return getCalendarDays(viewingDate || todayInput());
  }, [viewingDate]);

  const jobGeofences = useMemo(() => {
    return jobs
      .filter((job) => job.location?.lat && job.location?.lng)
      .map((job) => ({
        jobId: job.id,
        jobName: job.name || job.address || `Job ${job.id}`,
        lat: Number(job.location.lat),
        lng: Number(job.location.lng),
        radiusMeters: Number(job.location.radiusMeters || 150),
      }));
  }, [jobs]);

  const mapPoints = useMemo(() => {
    return [
      ...visibleTrips.flatMap((trip) => trip.line),
      ...jobGeofences.map((job) => [job.lat, job.lng]),
    ];
  }, [visibleTrips, jobGeofences]);

  const linkedTripIds = useMemo(() => {
    return new Set(links.map((link) => String(link.tripId)));
  }, [links]);

  const dayMiles = useMemo(() => {
    return trips.reduce((sum, trip) => sum + Number(trip.miles || 0), 0);
  }, [trips]);

  const allocatedMiles = useMemo(() => {
    return links.reduce(
      (sum, link) => sum + Number(link.distanceMiles || 0),
      0,
    );
  }, [links]);

  async function api(path, options) {
    const res = await fetch(`${API_BASE}${path}`, options);

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`${res.status}: ${text || res.statusText}`);
    }

    return res.json();
  }

  async function loadAllLinks() {
    const data = await api("/api/traccar/trip-links");
    const nextLinks = Array.isArray(data) ? data : [];
    setAllLinks(nextLinks);
    return nextLinks;
  }

  async function loadLinks(selectedDate) {
    const data = await api(`/api/traccar/trip-links?date=${selectedDate}`);
    const nextLinks = Array.isArray(data) ? data : [];
    setLinks(nextLinks);
    return nextLinks;
  }

  function getTripLink(tripId) {
    return links.find((link) => String(link.tripId) === String(tripId));
  }

  function makeSuggestions(nextTrips) {
    const nextSuggestions = [];

    nextTrips.forEach((trip) => {
      if (!trip.end) return;

      jobGeofences.forEach((job) => {
        const distance = distanceMeters(trip.end, [job.lat, job.lng]);

        if (distance <= job.radiusMeters) {
          nextSuggestions.push({
            tripId: trip.id,
            jobId: job.jobId,
            jobName: job.jobName,
            distanceMeters: distance,
            distanceMiles: trip.miles,
            tripStartTime: trip.startTime,
            tripEndTime: trip.endTime,
          });
        }
      });
    });

    return nextSuggestions;
  }

  async function loadDay(selectedDate = date) {
    setLoading(true);
    setError("");

    try {
      const day = await api(
        `/api/tracking/combined/day/${selectedDate}?deviceId=1`,
      );

      const nextTrips = Array.isArray(day.trips)
        ? day.trips.map(normaliseTrip).filter((trip) => trip.line.length > 1)
        : [];

      const nextLinks = await loadLinks(selectedDate);
      await loadAllLinks();

      setTrips(nextTrips);
      setLinks(nextLinks);
      setSuggestions(makeSuggestions(nextTrips));
      setViewingDate(selectedDate);
      setSelectedTripId(nextTrips[0]?.id || null);
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to load tracking day");
      setTrips([]);
      setLinks([]);
      setSuggestions([]);
      setSelectedTripId(null);
    } finally {
      setLoading(false);
    }
  }

  async function allocateTrip({
    trip,
    type,
    jobId = null,
    jobName = "",
    note = "",
  }) {
    setAllocatingTripId(trip.id);
    setError("");

    try {
      await api("/api/traccar/trip-links", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          date: viewingDate,
          tripId: trip.id ?? trip.displayNumber,
          type,
          jobId,
          jobName,
          distanceMiles: trip.miles || 0,
          startTime: trip.startTime,
          endTime: trip.endTime,
          note,
        }),
      });

      await loadLinks(viewingDate);
      await loadAllLinks();
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to allocate trip");
    } finally {
      setAllocatingTripId(null);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function loadSelectedTripAddresses() {
      if (!selectedTrip?.start || !selectedTrip?.end) {
        setStartAddress(null);
        setEndAddress(null);
        return;
      }

      setAddressLoading(true);
      setAddressError("");

      try {
        const [start, end] = await Promise.all([
          reverseGeocode(selectedTrip.start),
          reverseGeocode(selectedTrip.end),
        ]);

        if (!cancelled) {
          setStartAddress(start);
          setEndAddress(end);
        }
      } catch (err) {
        console.error(err);

        if (!cancelled) {
          setAddressError("Could not resolve one or both addresses.");
          setStartAddress(getCachedAddress(selectedTrip.start));
          setEndAddress(getCachedAddress(selectedTrip.end));
        }
      } finally {
        if (!cancelled) setAddressLoading(false);
      }
    }

    loadSelectedTripAddresses();

    return () => {
      cancelled = true;
    };
  }, [selectedTrip?.id]);

  useEffect(() => {
    loadAllLinks().catch(console.error);
    loadDay(todayInput());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobGeofences.length]);

  return (
    <div className="jobTrackerPage">
      <style>{`
        .jobTrackerPage {
          width: 100%;
          max-width: 1380px;
          display: grid;
          grid-template-columns: 340px minmax(520px, 1fr) 320px;
          gap: 18px;
          color: var(--text-main);
          user-select: none;
        }

        .jobTrackerPage input,
        .jobTrackerPage select,
        .jobTrackerPage textarea {
          user-select: text;
        }

        .trackerPanel,
        .trackerMapShell,
        .trackerSidePanel {
          background: var(--bg-panel);
          border: var(--border-soft);
          border-radius: var(--radius-lg);
          box-shadow: var(--shadow-soft);
        }

        .trackerPanel,
        .trackerSidePanel {
          padding: 1rem;
          max-height: calc(100vh - 150px);
          overflow-y: auto;
        }

        .trackerTitle {
          margin-bottom: 0.35rem;
        }

        .muted {
          color: var(--text-soft);
          font-size: 0.9rem;
        }

.calendarPanel {
  margin: 1rem 0;
  padding: 0.75rem;
  background: var(--panel-soft);
  border: var(--border-soft);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.calendarHeader {
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 0.75rem;
  align-items: center;
  margin-bottom: 0.75rem;
}

.calendarHeader strong {
  display: block;
  color: #fff;
  font-size: 0.95rem;
  line-height: 1.1;
}

.calendarHeader p {
  margin-top: 0.15rem;
  font-size: 0.75rem;
}

.calendarNavButton {
  width: 34px;
  height: 34px;
  padding: 0;
  border-radius: 999px;
  background: rgba(90, 130, 255, 0.12);
  color: #9db8ff;
  border: 1px solid rgba(90, 130, 255, 0.35);
  box-shadow: none;
}

.dayStrip {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 6px;
  width: 100%;
  overflow: hidden;
}

        .daySquare {
  min-width: 0;
  min-height: 48px;
  border-radius: 12px;
          background: rgba(255, 255, 255, 0.045);
          border: var(--border-soft);
          color: var(--text-soft);
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          gap: 2px;
          padding: 6px;
          box-shadow: none;
        }

        .daySquare:hover {
          background: rgba(90, 130, 255, 0.14);
        }

.daySquare.active {
  border-color: rgba(255, 255, 255, 0.75);
  background: rgba(90, 130, 255, 0.28);
  color: #fff;
  box-shadow: 0 0 0 2px rgba(90, 130, 255, 0.22);
}

        .daySquare.allocated {
          border-color: rgba(40, 180, 100, 0.45);
          background: rgba(40, 180, 100, 0.12);
        }

        .daySquare.today {
          box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.22);
        }

        .daySquare strong {
          font-size: 1rem;
          color: #fff;
        }

        .dateJump {
          display: flex;
          gap: 8px;
          margin-bottom: 1rem;
        }

        .dateJump input {
          flex: 1;
        }

        .trackerMetricGrid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0.75rem;
          margin-bottom: 1rem;
        }

        .trackerMetric {
          background: var(--panel-soft);
          border: var(--border-soft);
          border-radius: var(--radius-md);
          padding: 0.85rem;
          text-align: center;
        }

        .trackerMetric strong {
          display: block;
          margin-top: 0.25rem;
          font-size: 1.35rem;
          color: #fff;
        }

        .tripList {
          display: flex;
          flex-direction: column;
          gap: 0.65rem;
        }

        .tripCard {
          text-align: left;
          width: 100%;
          background: rgba(90, 130, 255, 0.1);
          border: 1px solid rgba(90, 130, 255, 0.28);
          border-radius: var(--radius-md);
          padding: 0.85rem;
          color: var(--text-main);
          box-shadow: none;
        }

        .tripCard:hover {
          background: rgba(90, 130, 255, 0.17);
          transform: translateY(-1px);
          box-shadow: var(--shadow-soft);
        }

        .tripCard.allocated {
          background: rgba(40, 180, 100, 0.12);
          border-color: rgba(40, 180, 100, 0.42);
          opacity: 0.88;
        }

        .tripCard.selected {
          border-color: rgba(255, 255, 255, 0.65);
          box-shadow: 0 0 0 2px rgba(90, 130, 255, 0.24);
        }

        .tripCardTop {
          display: flex;
          justify-content: space-between;
          gap: 10px;
          align-items: flex-start;
        }

        .tripBadge {
          font-size: 0.72rem;
          padding: 0.25rem 0.55rem;
          border-radius: var(--radius-pill);
          background: rgba(255, 255, 255, 0.08);
          color: var(--text-soft);
          white-space: nowrap;
        }

        .tripBadge.allocated {
          color: #75e6a0;
          background: rgba(40, 180, 100, 0.14);
        }

        .tripSkeleton {
          height: 82px;
          border-radius: var(--radius-md);
          background: linear-gradient(
            90deg,
            rgba(255, 255, 255, 0.04),
            rgba(255, 255, 255, 0.1),
            rgba(255, 255, 255, 0.04)
          );
          background-size: 200% 100%;
          animation: ghostPulse 1.15s infinite linear;
          border: var(--border-soft);
        }

        @keyframes ghostPulse {
          from { background-position: 200% 0; }
          to { background-position: -200% 0; }
        }

        .trackerMapShell {
          overflow: hidden;
          min-height: calc(100vh - 150px);
          display: grid;
          grid-template-rows: minmax(520px, 1fr) auto;
        }

        .mapCard {
          position: relative;
          min-height: 560px;
          background: var(--bg-main);
        }

        .mapCard .leaflet-container {
          width: 100%;
          height: 100%;
          min-height: 560px;
          background: var(--bg-main);
        }

        .mapHeader {
          position: absolute;
          top: 14px;
          left: 14px;
          z-index: 500;
          padding: 0.8rem 1rem;
          border-radius: var(--radius-md);
          background: rgba(30, 30, 47, 0.94);
          border: var(--border-soft);
          box-shadow: var(--shadow-soft);
          backdrop-filter: blur(8px);
        }

        .tripDetails {
          padding: 1rem;
          border-top: var(--border-soft);
          background: linear-gradient(145deg, rgba(30, 30, 47, 0.95), rgba(15, 23, 42, 0.88));
        }

        .tripDetailsGrid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 0.75rem;
          margin-top: 0.75rem;
        }

        .tripDetailBox {
          background: var(--panel-soft);
          border: var(--border-soft);
          border-radius: var(--radius-md);
          padding: 0.8rem;
        }

        .tripDetailBox span {
          display: block;
          color: var(--text-soft);
          font-size: 0.78rem;
          margin-bottom: 0.25rem;
        }

        .tripDetailBox strong {
          color: #fff;
        }

        .locationGrid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0.75rem;
          margin-top: 0.9rem;
        }

        .locationCard,
        .reportPanel {
          background: var(--panel-soft);
          border: var(--border-soft);
          border-radius: var(--radius-md);
          padding: 0.9rem;
        }

        .locationLabel {
          display: block;
          color: var(--text-soft);
          font-size: 0.78rem;
          margin-bottom: 0.3rem;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          font-weight: 800;
        }

        .locationCard strong {
          display: block;
          color: #fff;
          line-height: 1.35;
        }

        .coordinateText {
          margin: 0.65rem 0;
          font-family: monospace;
        }

        .locationActions {
          display: flex;
          gap: 0.5rem;
          flex-wrap: wrap;
        }

        .locationActions a,
        .locationActions button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 34px;
          padding: 0.45rem 0.7rem;
          border-radius: var(--radius-pill);
          background: rgba(90, 130, 255, 0.12);
          border: 1px solid rgba(90, 130, 255, 0.35);
          color: #9db8ff;
          font-size: 0.8rem;
          text-decoration: none;
          box-shadow: none;
        }

        .reportPanel {
          margin-top: 0.9rem;
          display: flex;
          justify-content: space-between;
          gap: 1rem;
          align-items: center;
        }

        .reportButton {
          padding: 0.8rem 1rem;
          border-radius: var(--radius-md);
          background: rgba(40, 180, 100, 0.15);
          color: #75e6a0;
          border: 1px solid rgba(40, 180, 100, 0.4);
          min-width: 230px;
        }

        .allocationPanel {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .allocationField {
          display: flex;
          flex-direction: column;
          gap: 0.4rem;
          color: var(--text-soft);
          font-size: 0.85rem;
          font-weight: 700;
        }

        .allocationField select,
        .allocationField input {
          width: 100%;
        }

        .allocationActions {
          display: grid;
          grid-template-columns: 1fr;
          gap: 0.75rem;
        }

        .allocationExisting,
        .suggestionCard {
          padding: 0.85rem;
          border-radius: var(--radius-md);
        }

        .allocationExisting {
          background: rgba(40, 180, 100, 0.12);
          border: 1px solid rgba(40, 180, 100, 0.4);
        }

        .suggestionCard {
          background: rgba(90, 130, 255, 0.12);
          border: 1px solid rgba(90, 130, 255, 0.35);
        }

        .successButton {
          background: rgba(40, 180, 100, 0.15);
          color: #75e6a0;
          border: 1px solid rgba(40, 180, 100, 0.4);
        }

        .dangerButton {
          background: rgba(180, 40, 40, 0.15);
          color: #ff8c8c;
          border: 1px solid rgba(180, 40, 40, 0.4);
        }

        .directionArrowIcon {
          display: grid;
          place-items: center;
          color: rgba(255, 255, 255, 0.85);
          background: rgba(90, 130, 255, 0.7);
          border: 1px solid rgba(255, 255, 255, 0.4);
          border-radius: 999px;
          font-size: 14px;
          font-weight: 900;
          box-shadow: 0 0 12px rgba(90, 130, 255, 0.35);
        }

        .geofenceLabel {
          background: rgba(20, 20, 28, 0.92);
          color: #fff;
          border: 1px solid rgba(255, 255, 255, 0.16);
          border-radius: 999px;
          padding: 4px 8px;
          font-size: 11px;
          font-weight: 800;
          box-shadow: var(--shadow-soft);
        }

        .errorBox {
          margin-top: 1rem;
          padding: 0.75rem 1rem;
          border: var(--danger-border);
          background: var(--danger-soft);
          color: #ff9fa0;
          border-radius: var(--radius-md);
          font-size: 0.85rem;
        }

        @media (max-width: 1150px) {
          .jobTrackerPage {
            grid-template-columns: 1fr;
          }

          .trackerPanel,
          .trackerSidePanel {
            max-height: none;
          }

          .tripDetailsGrid {
            grid-template-columns: 1fr 1fr;
          }

          .locationGrid {
            grid-template-columns: 1fr;
          }

          .reportPanel {
            flex-direction: column;
            align-items: stretch;
          }

          .reportButton {
            width: 100%;
          }
        }
      `}</style>

      <aside className="trackerPanel">
        <h1 className="trackerTitle">Trips</h1>
        <p className="muted">Pick a day, then select a trip.</p>

        <div className="calendarPanel">
          <div className="calendarHeader">
            <button
              type="button"
              className="calendarNavButton"
              onClick={() => {
                const previous = addDays(viewingDate, -7);
                setDate(previous);
                loadDay(previous);
              }}
            >
              ←
            </button>

            <div>
              <strong>
                {new Date(`${viewingDate}T00:00:00`).toLocaleDateString(
                  "en-GB",
                  {
                    month: "long",
                    year: "numeric",
                  },
                )}
              </strong>
              <p className="muted">Viewing {viewingDate}</p>
            </div>

            <button
              type="button"
              className="calendarNavButton"
              onClick={() => {
                const next = addDays(viewingDate, 7);
                setDate(next);
                loadDay(next);
              }}
            >
              →
            </button>
          </div>

          <div className="dayStrip">
            {calendarDays.map((day) => (
              <button
                key={day.date}
                type="button"
                className={`daySquare ${
                  day.date === viewingDate ? "active" : ""
                } ${allocatedDates.has(day.date) ? "allocated" : ""} ${
                  day.isToday ? "today" : ""
                }`}
                onClick={() => {
                  setDate(day.date);
                  loadDay(day.date);
                }}
              >
                <span>{day.weekday}</span>
                <strong>{day.dayNumber}</strong>
              </button>
            ))}
          </div>
        </div>

        <div className="dateJump">
          <input
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            onMouseDown={(event) => event.stopPropagation()}
          />

          <button onClick={() => loadDay(date)}>
            {loading ? "..." : "Go"}
          </button>
        </div>

        <div className="trackerMetricGrid">
          <div className="trackerMetric">
            <span className="muted">Day Miles</span>
            <strong>{formatMiles(dayMiles)}</strong>
          </div>

          <div className="trackerMetric">
            <span className="muted">Allocated</span>
            <strong>{formatMiles(allocatedMiles)}</strong>
          </div>
        </div>

        <div className="tripList">
          {loading
            ? [1, 2, 3, 4].map((item) => (
                <div className="tripSkeleton" key={item} />
              ))
            : trips.map((trip) => {
                const link = getTripLink(trip.id);
                const allocated = Boolean(link);
                const selected = String(selectedTripId) === String(trip.id);

                return (
                  <button
                    key={trip.id}
                    className={`tripCard ${allocated ? "allocated" : ""} ${
                      selected ? "selected" : ""
                    }`}
                    onClick={() => setSelectedTripId(trip.id)}
                  >
                    <div className="tripCardTop">
                      <div>
                        <strong>Trip {trip.displayNumber}</strong>
                        <p className="muted">
                          {formatTime(trip.startTime)} →{" "}
                          {formatTime(trip.endTime)}
                        </p>
                        <p className="muted">{formatMiles(trip.miles)}</p>
                      </div>

                      <span
                        className={`tripBadge ${allocated ? "allocated" : ""}`}
                      >
                        {allocated ? link.type : "Unallocated"}
                      </span>
                    </div>

                    {allocated && (
                      <p className="muted">
                        {link.jobName || link.note || "Allocated"}
                      </p>
                    )}
                  </button>
                );
              })}
        </div>

        {!loading && trips.length === 0 && (
          <p className="muted">No trips found for this date.</p>
        )}

        {error && <div className="errorBox">{error}</div>}
      </aside>

      <main className="trackerMapShell">
        <section className="mapCard">
          <div className="mapHeader">
            <strong>Viewing {viewingDate}</strong>

            <div className="muted">
              {selectedTrip
                ? `Trip ${selectedTrip.displayNumber} selected`
                : "All trips shown"}
            </div>
          </div>

          <MapContainer center={DEFAULT_CENTER} zoom={12}>
            <TileLayer
              attribution="&copy; OpenStreetMap contributors &copy; CARTO"
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            />

            <FitMap points={mapPoints} selectedTripId={selectedTripId} />

            {jobGeofences.map((job) => (
              <Circle
                key={job.jobId}
                center={[job.lat, job.lng]}
                radius={job.radiusMeters}
                pathOptions={{
                  color: "#75e6a0",
                  fillColor: "#75e6a0",
                  fillOpacity: 0.07,
                  weight: 1.5,
                }}
              >
                <Tooltip
                  permanent
                  direction="top"
                  offset={[0, -8]}
                  className="geofenceLabel"
                >
                  {job.jobName}
                </Tooltip>

                <Popup>
                  <strong>{job.jobName}</strong>
                  <br />
                  Radius: {job.radiusMeters}m
                </Popup>
              </Circle>
            ))}

            {visibleTrips.map((trip) => {
              const allocated = linkedTripIds.has(String(trip.id));
              const selected = String(selectedTripId) === String(trip.id);
              const colour = allocated ? "#75e6a0" : "#9db8ff";
              const middle = getMiddlePoint(trip.line);

              return (
                <div key={trip.id}>
                  <Polyline
                    positions={trip.line}
                    pathOptions={{
                      color: colour,
                      weight: selected ? 4 : allocated ? 2.5 : 3,
                      opacity: allocated ? 0.68 : 0.9,
                    }}
                  >
                    <Popup>
                      <strong>Trip {trip.displayNumber}</strong>
                      <br />
                      {formatTime(trip.startTime)} → {formatTime(trip.endTime)}
                      <br />
                      {formatMiles(trip.miles)}
                    </Popup>
                  </Polyline>

                  {trip.start && (
                    <CircleMarker
                      center={trip.start}
                      radius={5}
                      pathOptions={{
                        color: "rgba(255,255,255,0.65)",
                        fillColor: "#75e6a0",
                        fillOpacity: 0.75,
                        weight: 1.5,
                      }}
                    >
                      <Tooltip direction="right">Start</Tooltip>
                    </CircleMarker>
                  )}

                  {trip.end && (
                    <CircleMarker
                      center={trip.end}
                      radius={5}
                      pathOptions={{
                        color: "rgba(255,255,255,0.65)",
                        fillColor: "#ff8c8c",
                        fillOpacity: 0.75,
                        weight: 1.5,
                      }}
                    >
                      <Tooltip direction="right">End</Tooltip>
                    </CircleMarker>
                  )}

                  {middle && (
                    <Marker position={middle} icon={makeDirectionIcon()} />
                  )}
                </div>
              );
            })}
          </MapContainer>
        </section>

        <section className="tripDetails">
          {selectedTrip ? (
            <>
              <h2>Trip {selectedTrip.displayNumber} Details</h2>

              <p className="muted">
                {selectedTripLink
                  ? `Allocated as ${selectedTripLink.type}`
                  : "This trip is currently unallocated."}
              </p>

              <div className="tripDetailsGrid">
                <div className="tripDetailBox">
                  <span>Start</span>
                  <strong>{formatDateTime(selectedTrip.startTime)}</strong>
                </div>

                <div className="tripDetailBox">
                  <span>End</span>
                  <strong>{formatDateTime(selectedTrip.endTime)}</strong>
                </div>

                <div className="tripDetailBox">
                  <span>Duration</span>
                  <strong>
                    {formatDuration(
                      selectedTrip.startTime,
                      selectedTrip.endTime,
                    )}
                  </strong>
                </div>

                <div className="tripDetailBox">
                  <span>Miles</span>
                  <strong>{formatMiles(selectedTrip.miles)}</strong>
                </div>

                <div className="tripDetailBox">
                  <span>GPS Points</span>
                  <strong>
                    {selectedTrip.rawPointCount || selectedTrip.line.length}
                  </strong>
                </div>
              </div>

              <div className="locationGrid">
                <TripLocationCard
                  title="Journey Started"
                  coords={selectedTrip.start}
                  address={startAddress}
                  loading={addressLoading}
                />

                <TripLocationCard
                  title="Journey Ended"
                  coords={selectedTrip.end}
                  address={endAddress}
                  loading={addressLoading}
                />
              </div>

              {addressError && <div className="errorBox">{addressError}</div>}

              <div className="reportPanel">
                <div>
                  <strong>Generate Trip Report</strong>
                  <p className="muted">
                    Creates a professional PDF for this selected journey only.
                    Allocation stays separate.
                  </p>
                </div>

                <button
                  type="button"
                  className="reportButton"
                  onClick={() =>
                    generateTripReportPdf({
                      trip: selectedTrip,
                      startAddress,
                      endAddress,
                      viewingDate,
                    })
                  }
                >
                  Generate Trip Report PDF
                </button>
              </div>
            </>
          ) : (
            <p className="muted">Select a trip from the left.</p>
          )}
        </section>
      </main>

      <aside className="trackerSidePanel">
        <TripAllocationPanel
          trip={selectedTrip}
          jobs={jobs}
          suggestions={suggestions.filter(
            (item) => String(item.tripId) === String(selectedTrip?.id),
          )}
          existingLink={selectedTrip ? getTripLink(selectedTrip.id) : null}
          allocating={selectedTrip && allocatingTripId === selectedTrip.id}
          onSave={allocateTrip}
        />
      </aside>
    </div>
  );
}

