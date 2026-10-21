import { useEffect, useMemo, useRef, useState } from "react";
import "./SchedulePage.css";
import { getJobColour } from "./jobColour";

const API_BASE = "";
const DAY_MS = 86400000;
const RESOURCE_SECTIONS = [
  ["assignedPeople", "team", "JNR team"],
  ["assignedSubcontractors", "subcontractor", "Subcontractors"],
  ["assignedVehicles", "vehicle", "Vehicles"],
  ["assignedEquipment", "equipment", "Equipment"],
];
const DELAY_REASONS = ["Weather", "Materials", "Client", "Building Control", "Subcontractor", "JNR/resource issue", "Access", "Design/drawings", "Other"];

function isoDate(value) {
  const date = value instanceof Date ? value : new Date(`${value}T12:00:00Z`);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

function addDays(value, amount) {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return isoDate(date);
}

function addMonths(value, amount) {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + amount);
  return isoDate(date);
}

function firstOfMonth(value) {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(1);
  return isoDate(date);
}

function startOfWeek(value = new Date()) {
  const date = new Date(value);
  date.setUTCHours(12, 0, 0, 0);
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() - day + 1);
  return isoDate(date);
}

function daysBetween(start, end) {
  return Math.round((new Date(`${end}T12:00:00Z`) - new Date(`${start}T12:00:00Z`)) / DAY_MS);
}

function formatDay(value, compact = false) {
  return new Date(`${value}T12:00:00Z`).toLocaleDateString("en-GB", compact
    ? { weekday: "short", day: "numeric" }
    : { weekday: "long", day: "numeric", month: "short" });
}

function formatRange(start, end) {
  if (!start) return "No dates";
  if (start === end) return formatDay(start);
  return `${formatDay(start, true)} – ${formatDay(end, true)}`;
}

function blankEntry(jobId = "", date = isoDate(new Date())) {
  return {
    id: "",
    kind: "job",
    title: "",
    jobId: String(jobId || ""),
    startDate: date,
    endDate: date,
    startTime: "",
    endTime: "",
    assignedPeople: [],
    assignedSubcontractors: [],
    assignedVehicles: [],
    assignedEquipment: [],
    note: "",
    status: "planned",
  };
}

function blankHoliday(date = isoDate(new Date()), resourceId = "") {
  return {
    id: "",
    kind: "holiday",
    title: "Holiday",
    jobId: "",
    startDate: date,
    endDate: date,
    startTime: "",
    endTime: "",
    assignedPeople: resourceId ? [String(resourceId)] : [],
    assignedSubcontractors: [],
    assignedVehicles: [],
    assignedEquipment: [],
    note: "",
    status: "confirmed",
  };
}

function entryResourceIds(entry) {
  return RESOURCE_SECTIONS.flatMap(([field]) => entry[field] || []);
}

function calendarTargetAtPoint(clientX, clientY, fallbackElement = null) {
  const element = document.elementFromPoint(clientX, clientY) || fallbackElement;
  const calendar = element?.closest?.("[data-calendar-start]");
  if (!calendar) return null;
  const bounds = calendar.getBoundingClientRect();
  const columns = Math.max(1, Number(calendar.dataset.calendarColumns) || 7);
  const column = Math.max(0, Math.min(columns - 1, Math.floor(((clientX - bounds.left) / Math.max(1, bounds.width)) * columns)));
  return {
    date: addDays(calendar.dataset.calendarStart, column),
    resourceId: calendar.dataset.resourceId || "",
  };
}

function layoutWeekEntries(entries, weekDays) {
  const weekStart = weekDays[0];
  const weekEnd = weekDays[weekDays.length - 1];
  const candidates = entries
    .filter((entry) => entry.startDate <= weekEnd && entry.endDate >= weekStart)
    .sort((a, b) => a.startDate.localeCompare(b.startDate) || b.endDate.localeCompare(a.endDate));
  const laneEnds = [];
  const segments = candidates.map((entry) => {
    const segmentStart = entry.startDate < weekStart ? weekStart : entry.startDate;
    const segmentEnd = entry.endDate > weekEnd ? weekEnd : entry.endDate;
    const startColumn = daysBetween(weekStart, segmentStart) + 1;
    const endColumn = daysBetween(weekStart, segmentEnd) + 1;
    let lane = laneEnds.findIndex((occupiedUntil) => occupiedUntil < startColumn);
    if (lane === -1) lane = laneEnds.length;
    laneEnds[lane] = endColumn;
    return {
      entry,
      segmentStart,
      segmentEnd,
      startColumn,
      span: endColumn - startColumn + 1,
      lane,
    };
  });
  return { segments, laneCount: Math.max(1, laneEnds.length) };
}

function SchedulePage({ jobs = [], navigate, currentUser, initialJobId }) {
  const [viewMode, setViewMode] = useState("month");
  const [cursorDate, setCursorDate] = useState(isoDate(new Date()));
  const [resources, setResources] = useState([]);
  const [entries, setEntries] = useState([]);
  const [form, setForm] = useState(null);
  const [delayForm, setDelayForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [jobSearch, setJobSearch] = useState("");
  const [sourceType, setSourceType] = useState("jobs");
  const [conflict, setConflict] = useState(null);
  const [boardReady, setBoardReady] = useState(false);
  const [dragPreview, setDragPreview] = useState(null);
  const initialJobHandled = useRef(false);
  const pointerDrag = useRef(null);
  const finishPointerDrag = useRef(null);
  const suppressJobClickUntil = useRef(0);

  const rangeStart = useMemo(
    () => viewMode === "month" ? startOfWeek(firstOfMonth(cursorDate)) : startOfWeek(cursorDate),
    [cursorDate, viewMode],
  );
  const viewDays = viewMode === "month"
    ? Math.max(35, daysBetween(rangeStart, addDays(startOfWeek(addDays(addMonths(firstOfMonth(cursorDate), 1), -1)), 6)) + 1)
    : viewMode === "fortnight" ? 14 : 7;
  const days = useMemo(
    () => Array.from({ length: viewDays }, (_, index) => addDays(rangeStart, index)),
    [rangeStart, viewDays],
  );
  const rangeEnd = days[days.length - 1];
  const activeJobs = useMemo(() => {
    const usefulStatuses = new Set(["Active", "In Progress", "Booked", "Approved", "Accepted", "Not Started", "Quoted", "To-Quote", "Lead"]);
    const query = jobSearch.trim().toLowerCase();
    return jobs
      .filter((job) => !job.archived && usefulStatuses.has(job.status || "Not Started"))
      .filter((job) => !query || `${job.name} ${job.address} ${job.clientName || job.client || ""}`.toLowerCase().includes(query))
      .sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
  }, [jobs, jobSearch]);
  const resourceMap = useMemo(
    () => new Map(resources.map((resource) => [String(resource.id), resource])),
    [resources],
  );
  const jobMap = useMemo(
    () => new Map(jobs.map((job) => [String(job.id), job])),
    [jobs],
  );

  async function loadBoard() {
    setBoardReady(false);
    setMessage("Loading schedule…");
    try {
      const [resourceResponse, scheduleResponse] = await Promise.all([
        fetch(`${API_BASE}/api/resources`),
        fetch(`${API_BASE}/api/schedule?from=${rangeStart}&to=${rangeEnd}`),
      ]);
      const resourceData = await resourceResponse.json().catch(() => ({}));
      const scheduleData = await scheduleResponse.json().catch(() => ({}));
      if (!resourceResponse.ok) throw new Error(resourceData.error || "Could not load resources.");
      if (!scheduleResponse.ok) throw new Error(scheduleData.error || "Could not load the schedule.");
      setResources(Array.isArray(resourceData.resources) ? resourceData.resources : []);
      setEntries(Array.isArray(scheduleData.entries) ? scheduleData.entries : []);
      setBoardReady(true);
      setMessage("");
    } catch (error) {
      setMessage(error.message);
    }
  }

  useEffect(() => {
    loadBoard();
  }, [rangeStart, rangeEnd]);

  useEffect(() => {
    if (initialJobHandled.current || !initialJobId || !jobs.length || !boardReady) return;
    initialJobHandled.current = true;
    const visibleBooking = entries.find((entry) => String(entry.jobId) === String(initialJobId));
    setForm(visibleBooking ? { ...visibleBooking } : blankEntry(initialJobId, isoDate(new Date())));
  }, [initialJobId, jobs.length, entries, boardReady]);

  function toggleResource(field, resourceId) {
    setForm((current) => {
      const selected = new Set(current[field] || []);
      if (selected.has(resourceId)) selected.delete(resourceId);
      else selected.add(resourceId);
      return { ...current, [field]: [...selected] };
    });
  }

  async function submitRequest(url, method, body) {
    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({}));
    if (response.status === 409) {
      setConflict({ conflicts: data.conflicts || [], request: { url, method, body } });
      return null;
    }
    if (!response.ok) throw new Error(data.error || "Could not update the schedule.");
    return data;
  }

  async function saveEntry(event, overrideConflicts = false) {
    event?.preventDefault?.();
    const isHoliday = form?.kind === "holiday";
    if (!isHoliday && !form?.jobId) {
      setMessage("Choose a job first.");
      return;
    }
    if (isHoliday && !form.assignedPeople?.length) {
      setMessage("Choose who is on holiday.");
      return;
    }
    setSaving(true);
    setMessage(isHoliday ? "Saving holiday…" : "Saving booking…");
    try {
      const route = isHoliday ? "/api/schedule/holiday" : "/api/schedule";
      const url = form.id ? `${API_BASE}${route}/${encodeURIComponent(form.id)}` : `${API_BASE}${route}`;
      const method = form.id ? "PUT" : "POST";
      const data = await submitRequest(url, method, {
        ...form,
        kind: isHoliday ? "holiday" : "job",
        entryType: isHoliday ? "holiday" : "job",
        overrideConflicts,
      });
      if (!data) return;
      setForm(null);
      setConflict(null);
      await loadBoard();
      setMessage(isHoliday ? "Holiday added to the calendar." : "Schedule updated.");
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSaving(false);
    }
  }

  async function keepConflict() {
    if (!conflict?.request) return;
    setSaving(true);
    try {
      const data = await submitRequest(conflict.request.url, conflict.request.method, {
        ...conflict.request.body,
        overrideConflicts: true,
      });
      if (!data) return;
      setConflict(null);
      setForm(null);
      setDelayForm(null);
      await loadBoard();
      setMessage("Booking saved with the conflict kept.");
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSaving(false);
    }
  }

  function bookingForResource(jobId, date, resourceId) {
    const next = blankEntry(jobId, date);
    const resource = resourceMap.get(String(resourceId));
    const match = RESOURCE_SECTIONS.find(([, kind]) => kind === resource?.kind);
    if (match) next[match[0]] = [String(resourceId)];
    return next;
  }

  function holidayForResource(date, resourceId) {
    const resource = resourceMap.get(String(resourceId));
    return blankHoliday(date, resource?.kind === "team" ? resourceId : "");
  }

  function startPointerDrag(event, payload) {
    if (event.button !== 0 || saving) return;
    const entry = payload.entryId
      ? entries.find((item) => String(item.id) === String(payload.entryId))
      : null;
    const calendar = event.currentTarget.closest?.("[data-calendar-start]");
    const calendarColumns = Math.max(1, Number(calendar?.dataset.calendarColumns) || viewDays);
    const initialTarget = calendarTargetAtPoint(event.clientX, event.clientY, event.currentTarget);
    pointerDrag.current = {
      ...payload,
      entry: entry ? { ...entry } : null,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      clientX: event.clientX,
      clientY: event.clientY,
      columnWidth: calendar ? calendar.getBoundingClientRect().width / calendarColumns : 1,
      anchorDate: initialTarget?.date || entry?.startDate || "",
      active: false,
      previewStart: entry?.startDate || "",
      previewEnd: entry?.endDate || "",
      targetDate: "",
      targetResourceId: "",
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  async function commitPointerDrag(drag) {
    setDragPreview(null);
    if (!drag?.active) return;

    if (drag.kind === "job") {
      if (drag.targetDate) {
        setForm(bookingForResource(drag.jobId, drag.targetDate, drag.targetResourceId));
      }
      return;
    }

    if (drag.kind === "holiday-source") {
      if (drag.targetDate) {
        setForm(holidayForResource(drag.targetDate, drag.targetResourceId));
      }
      return;
    }

    if (!drag.entry || (drag.previewStart === drag.entry.startDate && drag.previewEnd === drag.entry.endDate)) return;
    setSaving(true);
    setMessage(drag.mode === "move" ? "Moving booking…" : "Changing booking dates…");
    try {
      const data = await submitRequest(
        `${API_BASE}/api/schedule/${encodeURIComponent(drag.entry.id)}`,
        "PUT",
        { ...drag.entry, startDate: drag.previewStart, endDate: drag.previewEnd },
      );
      if (data) {
        await loadBoard();
        setMessage(drag.mode === "move" ? "Booking moved." : "Booking dates updated.");
      }
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSaving(false);
    }
  }

  finishPointerDrag.current = commitPointerDrag;

  useEffect(() => {
    function updateDrag(event) {
      const drag = pointerDrag.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      const distance = Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY);
      if (!drag.active && distance < 5) return;

      drag.active = true;
      drag.clientX = event.clientX;
      drag.clientY = event.clientY;
      document.body.classList.add("schedulePointerDragging");
      event.preventDefault();

      if (drag.kind === "job" || drag.kind === "holiday-source") {
        const target = calendarTargetAtPoint(event.clientX, event.clientY);
        drag.targetDate = target?.date || "";
        drag.targetResourceId = target?.resourceId || "";
      } else if (drag.entry) {
        const target = calendarTargetAtPoint(event.clientX, event.clientY);
        const targetDate = target?.date || "";
        const dayDelta = targetDate && drag.anchorDate
          ? daysBetween(drag.anchorDate, targetDate)
          : Math.round((event.clientX - drag.startX) / Math.max(1, drag.columnWidth));
        if (drag.mode === "resize-start") {
          const candidate = targetDate || addDays(drag.entry.startDate, dayDelta);
          drag.previewStart = candidate <= drag.entry.endDate ? candidate : drag.entry.endDate;
          drag.previewEnd = drag.entry.endDate;
        } else if (drag.mode === "resize-end") {
          const candidate = targetDate || addDays(drag.entry.endDate, dayDelta);
          drag.previewStart = drag.entry.startDate;
          drag.previewEnd = candidate >= drag.entry.startDate ? candidate : drag.entry.startDate;
        } else {
          drag.previewStart = addDays(drag.entry.startDate, dayDelta);
          drag.previewEnd = addDays(drag.entry.endDate, dayDelta);
        }
      }
      setDragPreview({ ...drag, entry: drag.entry ? { ...drag.entry } : null });
    }

    function endDrag(event) {
      const drag = pointerDrag.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      pointerDrag.current = null;
      document.body.classList.remove("schedulePointerDragging");
      if (drag.active && (drag.kind === "job" || drag.kind === "holiday-source")) {
        suppressJobClickUntil.current = Date.now() + 300;
      }
      finishPointerDrag.current?.(drag);
    }

    function cancelDrag(event) {
      const drag = pointerDrag.current;
      if (!drag || (event.pointerId !== undefined && drag.pointerId !== event.pointerId)) return;
      pointerDrag.current = null;
      document.body.classList.remove("schedulePointerDragging");
      setDragPreview(null);
    }

    function cancelWithEscape(event) {
      if (event.key === "Escape" && pointerDrag.current) cancelDrag({});
    }

    window.addEventListener("pointermove", updateDrag, { passive: false });
    window.addEventListener("pointerup", endDrag);
    window.addEventListener("pointercancel", cancelDrag);
    window.addEventListener("keydown", cancelWithEscape);
    return () => {
      window.removeEventListener("pointermove", updateDrag);
      window.removeEventListener("pointerup", endDrag);
      window.removeEventListener("pointercancel", cancelDrag);
      window.removeEventListener("keydown", cancelWithEscape);
      document.body.classList.remove("schedulePointerDragging");
    };
  }, []);

  async function cancelEntry() {
    const itemName = form?.kind === "holiday" ? "holiday" : "booking";
    if (!form?.id || !window.confirm(`Remove this ${itemName} from the live schedule? Its history will be kept.`)) return;
    setSaving(true);
    try {
      const response = await fetch(`${API_BASE}/api/schedule/${encodeURIComponent(form.id)}`, { method: "DELETE" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not cancel the booking.");
      setForm(null);
      await loadBoard();
      setMessage(`${form.kind === "holiday" ? "Holiday" : "Booking"} removed from the live schedule.`);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSaving(false);
    }
  }

  async function saveDelay(event) {
    event.preventDefault();
    setSaving(true);
    try {
      const url = `${API_BASE}/api/schedule/${encodeURIComponent(delayForm.entryId)}/delay`;
      const data = await submitRequest(url, "POST", delayForm);
      if (!data) return;
      setDelayForm(null);
      setForm(null);
      await loadBoard();
      setMessage(delayForm.pushForward ? "Delay logged and the booking moved forward one working day." : "No attendance logged.");
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSaving(false);
    }
  }

  const boardRows = useMemo(() => {
    const rows = resources.map((resource) => ({
      resource,
      entries: entries.filter((entry) => entryResourceIds(entry).includes(String(resource.id))),
    }));
    const unassigned = entries.filter((entry) => !entryResourceIds(entry).length);
    if (unassigned.length) rows.push({ resource: { id: "unassigned", name: "Unassigned", kind: "other", colour: "#687082" }, entries: unassigned });
    return rows;
  }, [resources, entries]);

  const displayedEntries = useMemo(
    () => entries.map((entry) => dragPreview?.kind === "entry" && String(dragPreview.entryId) === String(entry.id)
      ? { ...entry, startDate: dragPreview.previewStart, endDate: dragPreview.previewEnd }
      : entry),
    [entries, dragPreview],
  );
  const monthWeeks = useMemo(
    () => viewMode === "month"
      ? Array.from({ length: days.length / 7 }, (_, weekIndex) => days.slice(weekIndex * 7, (weekIndex + 1) * 7))
      : [],
    [days, viewMode],
  );
  const monthLayouts = useMemo(
    () => monthWeeks.map((weekDays) => layoutWeekEntries(displayedEntries, weekDays)),
    [displayedEntries, monthWeeks],
  );

  function bookingColour(entry) {
    if (entry.kind === "holiday") return "#f2b84b";
    const job = jobMap.get(String(entry.jobId));
    return job ? getJobColour(job) : entry.jobColor || "#4f82ff";
  }

  function bookingResources(entry) {
    return entryResourceIds(entry).map((id) => resourceMap.get(String(id))).filter(Boolean);
  }

  function movePeriod(direction) {
    setCursorDate((current) => viewMode === "month"
      ? addMonths(current, direction)
      : addDays(current, direction * viewDays));
  }

  const today = isoDate(new Date());
  const periodLabel = viewMode === "month"
    ? new Date(`${cursorDate}T12:00:00Z`).toLocaleDateString("en-GB", { month: "long", year: "numeric" })
    : `${new Date(`${rangeStart}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long" })} – ${new Date(`${rangeEnd}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}`;
  const todayLabel = new Date(`${today}T12:00:00Z`).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const currentMonth = cursorDate.slice(0, 7);
  const defaultBookingDate = today >= rangeStart && today <= rangeEnd
    ? today
    : viewMode === "month" ? firstOfMonth(cursorDate) : rangeStart;

  return (
    <main className="schedulePage">
      <header className="scheduleHeader">
        <div><p className="scheduleEyebrow">JNR operations</p><h1>Schedule</h1><p>Plan site work and time away on one clear calendar.</p></div>
        <div className="scheduleHeaderActions"><button type="button" onClick={() => setForm(sourceType === "holidays" ? blankHoliday(defaultBookingDate) : blankEntry("", defaultBookingDate))}>+ New calendar item</button></div>
      </header>

      <section className="scheduleStats">
        <div><span>Work bookings</span><strong>{entries.filter((entry) => entry.kind !== "holiday" && entry.status !== "cancelled").length}</strong></div>
        <div><span>Holidays</span><strong>{entries.filter((entry) => entry.kind === "holiday" && entry.status !== "cancelled").length}</strong></div>
        <div><span>JNR team</span><strong>{resources.filter((resource) => resource.kind === "team").length}</strong></div>
        <div className="schedulePeriod"><span>Showing</span><strong>{periodLabel}</strong></div>
      </section>

      <section className="scheduleWorkspace">
        <aside className="scheduleJobs">
          <div className="schedulePanelHeading"><div><span>Add to calendar</span><strong>Choose what to place</strong></div><button type="button" onClick={() => setForm(sourceType === "holidays" ? blankHoliday(defaultBookingDate) : blankEntry("", defaultBookingDate))}>+</button></div>
          <div className="scheduleSourceTabs" role="tablist" aria-label="Calendar item type">
            <button type="button" role="tab" aria-selected={sourceType === "jobs"} className={sourceType === "jobs" ? "active" : ""} onClick={() => setSourceType("jobs")}><span>▣</span>Jobs</button>
            <button type="button" role="tab" aria-selected={sourceType === "holidays"} className={sourceType === "holidays" ? "active holiday" : "holiday"} onClick={() => setSourceType("holidays")}><span>☀</span>Holidays</button>
          </div>
          {sourceType === "jobs" ? (
            <>
              <p className="scheduleSourceHint">Drag a job onto a day, or click it to choose dates and people.</p>
              <input value={jobSearch} onChange={(event) => setJobSearch(event.target.value)} placeholder="Search jobs…" />
              <div className="scheduleJobList">
                {activeJobs.map((job) => (
                  <button
                    className="scheduleJobCard"
                    style={{ "--job-colour": getJobColour(job) }}
                    type="button"
                    onPointerDown={(event) => startPointerDrag(event, { kind: "job", jobId: job.id })}
                    onClick={() => {
                      if (Date.now() < suppressJobClickUntil.current) return;
                      setForm(blankEntry(job.id, defaultBookingDate));
                    }}
                    key={job.id}
                  >
                    <span className="scheduleJobThumb">{job.coverImageAssetId ? <img src={`${API_BASE}/api/immich/thumbnail/${encodeURIComponent(job.coverImageAssetId)}`} alt="" draggable="false" /> : <i />}</span>
                    <span><strong>{job.name}</strong><small>{job.address || job.siteAddress || "No address saved"}</small><em>{job.status || "Not started"}</em></span>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div className="scheduleHolidayTray">
              <p className="scheduleSourceHint">Drag Holiday onto a date, then choose who is away and when.</p>
              <button
                className="scheduleHolidayCard"
                type="button"
                onPointerDown={(event) => startPointerDrag(event, { kind: "holiday-source" })}
                onClick={() => {
                  if (Date.now() < suppressJobClickUntil.current) return;
                  setForm(blankHoliday(defaultBookingDate));
                }}
              >
                <span>☀</span>
                <span><strong>Holiday</strong><small>Annual leave / time away</small><em>Drag onto calendar</em></span>
              </button>
              <div className="scheduleHolidayKey"><i /><span><strong>Shown as a slim amber bar</strong><small>It blocks that person from work bookings on the same dates.</small></span></div>
            </div>
          )}
        </aside>

        <div className="scheduleBoardShell">
          <div className="scheduleToolbar">
            <div><button type="button" aria-label="Previous period" onClick={() => movePeriod(-1)}>←</button><button type="button" onClick={() => setCursorDate(today)}>Today</button><button type="button" aria-label="Next period" onClick={() => movePeriod(1)}>→</button></div>
            <div className="schedulePeriodHeading">
              <strong>{periodLabel}</strong>
              <button className="scheduleTodayReadout" type="button" onClick={() => setCursorDate(today)} title="Jump to today"><i />Today · {todayLabel}</button>
            </div>
            <div className="scheduleViewToggle"><button type="button" className={viewMode === "month" ? "active" : ""} onClick={() => setViewMode("month")}>Month</button><button type="button" className={viewMode === "week" ? "active" : ""} onClick={() => setViewMode("week")}>Week</button><button type="button" className={viewMode === "fortnight" ? "active" : ""} onClick={() => setViewMode("fortnight")}>Two weeks</button></div>
          </div>

          {viewMode === "month" ? (
            <div className="scheduleMonthBoard">
              <div className="scheduleMonthWeekdays">{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => <span key={day}>{day}</span>)}</div>
              <div className={`scheduleMonthWeeks ${monthWeeks.length === 5 ? "fiveWeeks" : "sixWeeks"}`}>
                {monthWeeks.map((weekDays, weekIndex) => {
                  const layout = monthLayouts[weekIndex];
                  return (
                    <div
                      className="scheduleMonthWeek"
                      data-calendar-start={weekDays[0]}
                      data-calendar-columns="7"
                      style={{
                        "--month-height": `${Math.max(126, 44 + layout.laneCount * 34)}px`,
                        "--month-mobile-height": `${Math.max(68, 28 + layout.laneCount * 20)}px`,
                      }}
                      key={weekDays[0]}
                    >
                      <div className="scheduleMonthDays">
                        {weekDays.map((date) => {
                          const day = new Date(`${date}T12:00:00Z`);
                          const isWeekend = [0, 6].includes(day.getUTCDay());
                          const isJobTarget = ["job", "holiday-source"].includes(dragPreview?.kind) && dragPreview.targetDate === date;
                          const isBookingTarget = dragPreview?.kind === "entry" && date >= dragPreview.previewStart && date <= dragPreview.previewEnd;
                          return (
                            <button className={`scheduleMonthDay ${date === today ? "today" : ""} ${date.slice(0, 7) !== currentMonth ? "outsideMonth" : ""} ${isWeekend ? "weekend" : ""} ${isJobTarget ? "jobDropTarget" : ""} ${isBookingTarget ? "bookingDropTarget" : ""}`} type="button" title="Double-click to create a work booking" onDoubleClick={() => setForm(blankEntry("", date))} key={date}>
                              {date === today && <b className="scheduleTodayCellLabel">Today</b>}
                              <span>{day.getUTCDate()}</span>
                              {(day.getUTCDate() === 1 || date === days[0]) && <small>{day.toLocaleDateString("en-GB", { month: "short" })}</small>}
                            </button>
                          );
                        })}
                      </div>
                      <div className="scheduleMonthEvents">
                        {layout.segments.map(({ entry, segmentStart, segmentEnd, startColumn, span, lane }) => {
                          const originalEntry = entries.find((item) => String(item.id) === String(entry.id)) || entry;
                          const isMoving = dragPreview?.kind === "entry" && String(dragPreview.entryId) === String(entry.id);
                          const assigned = bookingResources(entry);
                          const names = assigned.map((resource) => resource.name).join(", ");
                          return (
                            <button className={`scheduleMonthBooking ${entry.kind === "holiday" ? "holidayBooking" : ""} ${isMoving ? "isPointerDragging" : ""} ${segmentStart > entry.startDate ? "continuesBefore" : ""} ${segmentEnd < entry.endDate ? "continuesAfter" : ""}`} style={{ gridColumn: `${startColumn} / span ${span}`, gridRow: lane + 1, "--entry-colour": bookingColour(entry) }} type="button" title="Drag to move · double-click to edit" onPointerDown={(event) => startPointerDrag(event, { kind: "entry", entryId: entry.id, mode: "move" })} onDoubleClick={() => setForm({ ...originalEntry })} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setForm({ ...originalEntry }); } }} key={`${entry.id}-${weekDays[0]}`}>
                              {segmentStart === entry.startDate && <i className="leftHandle" aria-label="Resize booking start" onPointerDown={(event) => { event.stopPropagation(); startPointerDrag(event, { kind: "entry", entryId: entry.id, mode: "resize-start" }); }} />}
                              <span className="scheduleMonthBookingText"><strong>{entry.kind === "holiday" ? `☀ ${entry.title || "Holiday"}` : entry.jobName || jobMap.get(String(entry.jobId))?.name || "Job"}</strong><small>{entry.note || names || formatRange(entry.startDate, entry.endDate)}</small></span>
                              {assigned.length > 0 && <span className="scheduleMonthPeople">{assigned.slice(0, 3).map((resource) => <i style={{ "--avatar-colour": resource.colour }} title={resource.name} key={resource.id}>{resource.name.slice(0, 1).toUpperCase()}</i>)}{assigned.length > 3 && <b>+{assigned.length - 3}</b>}</span>}
                              {segmentEnd === entry.endDate && <i className="rightHandle" aria-label="Resize booking end" onPointerDown={(event) => { event.stopPropagation(); startPointerDrag(event, { kind: "entry", entryId: entry.id, mode: "resize-end" }); }} />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
          <div className={`scheduleBoard ${viewMode === "fortnight" ? "fortnight" : ""}`} style={{ "--schedule-days": viewDays }}>
            <div className="scheduleCorner">Resources</div>
            <div className="scheduleDayHeadings">{days.map((date) => <div className={`${date === today ? "today" : ""} ${[0,6].includes(new Date(`${date}T12:00:00Z`).getUTCDay()) ? "weekend" : ""}`} key={date}><span>{new Date(`${date}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "short" })}</span><strong>{new Date(`${date}T12:00:00Z`).getUTCDate()}</strong></div>)}</div>
            {boardRows.map(({ resource, entries: rowEntries }) => (
              <div className="scheduleBoardRow" key={resource.id}>
                <button className="scheduleResourceLabel" type="button" onClick={() => resource.id !== "unassigned" && navigate?.("ResourceProfile", { resourceId: resource.id })}>
                  <span className="scheduleResourceAvatar" style={{ "--resource-colour": resource.colour }}>{resource.profileImageUrl ? <img src={resource.profileImageUrl} alt="" draggable="false" /> : resource.name.slice(0, 2).toUpperCase()}</span>
                  <span><strong>{resource.name}</strong><small>{resource.kind === "team" ? resource.jobTitle || "JNR team" : resource.trade || resource.category || resource.kind}</small></span>
                </button>
                <div className="scheduleRowGrid" data-calendar-start={rangeStart} data-calendar-columns={viewDays} data-resource-id={resource.id}>
                  {days.map((date) => {
                    const jobDropTarget = ["job", "holiday-source"].includes(dragPreview?.kind) && dragPreview.targetDate === date && String(dragPreview.targetResourceId) === String(resource.id);
                    const movedEntryInRow = dragPreview?.kind === "entry" && rowEntries.some((item) => String(item.id) === String(dragPreview.entryId));
                    const dateInsidePreview = movedEntryInRow && date >= dragPreview.previewStart && date <= dragPreview.previewEnd;
                    return (
                      <div
                        className={`scheduleDropCell ${date === today ? "today" : ""} ${jobDropTarget ? "jobDropTarget" : ""} ${dateInsidePreview ? "bookingDropTarget" : ""}`}
                        data-schedule-date={date}
                        data-resource-id={resource.id}
                        key={date}
                      />
                    );
                  })}
                  {rowEntries.map((entry) => {
                    const isMoving = dragPreview?.kind === "entry" && String(dragPreview.entryId) === String(entry.id);
                    const renderedStart = isMoving ? dragPreview.previewStart : entry.startDate;
                    const renderedEnd = isMoving ? dragPreview.previewEnd : entry.endDate;
                    const visibleStart = renderedStart < rangeStart ? rangeStart : renderedStart > rangeEnd ? rangeEnd : renderedStart;
                    const visibleEnd = renderedEnd > rangeEnd ? rangeEnd : renderedEnd < rangeStart ? rangeStart : renderedEnd;
                    const startColumn = daysBetween(rangeStart, visibleStart) + 1;
                    const span = daysBetween(visibleStart, visibleEnd) + 1;
                    const colour = bookingColour(entry);
                    return (
                      <button
                        className={`scheduleBlock ${entry.kind === "holiday" ? "holidayBooking" : ""} ${isMoving ? "isPointerDragging" : ""}`}
                        style={{ gridColumn: `${startColumn} / span ${Math.max(1, span)}`, "--entry-colour": colour }}
                        type="button"
                        title="Drag to move · double-click to edit"
                        onPointerDown={(event) => startPointerDrag(event, { kind: "entry", entryId: entry.id, mode: "move" })}
                        onDoubleClick={() => setForm({ ...entry })}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            setForm({ ...entry });
                          }
                        }}
                        key={entry.id}
                      >
                        <i className="leftHandle" aria-label="Resize booking start" onPointerDown={(event) => { event.stopPropagation(); startPointerDrag(event, { kind: "entry", entryId: entry.id, mode: "resize-start" }); }} />
                        <span><strong>{entry.kind === "holiday" ? `☀ ${entry.title || "Holiday"}` : entry.jobName || jobMap.get(String(entry.jobId))?.name || "Job"}</strong><small>{entry.note || formatRange(entry.startDate, entry.endDate)}</small></span>
                        <i className="rightHandle" aria-label="Resize booking end" onPointerDown={(event) => { event.stopPropagation(); startPointerDrag(event, { kind: "entry", entryId: entry.id, mode: "resize-end" }); }} />
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            {!boardRows.length && <div className="scheduleEmptyBoard">Add team/resources in Settings, then place a job on the board.</div>}
          </div>
          )}
        </div>
      </section>

      {dragPreview?.active && (
        <div
          className={`scheduleDragBubble ${dragPreview.kind === "job" ? "job" : dragPreview.kind === "holiday-source" || dragPreview.entry?.kind === "holiday" ? "holiday" : "booking"}`}
          style={{
            left: dragPreview.clientX,
            top: dragPreview.clientY,
            "--drag-colour": dragPreview.kind === "holiday-source" || dragPreview.entry?.kind === "holiday"
              ? "#f2b84b"
              : getJobColour(
                  jobMap.get(String(dragPreview.jobId || dragPreview.entry?.jobId)),
                ),
          }}
        >
          <strong>{dragPreview.kind === "job" ? jobMap.get(String(dragPreview.jobId))?.name || "New booking" : dragPreview.kind === "holiday-source" ? "☀ Holiday" : dragPreview.entry?.kind === "holiday" ? dragPreview.entry.title || "Holiday" : dragPreview.entry?.jobName || jobMap.get(String(dragPreview.entry?.jobId))?.name || "Booking"}</strong>
          <span>{["job", "holiday-source"].includes(dragPreview.kind) ? (dragPreview.targetDate ? `Drop on ${formatDay(dragPreview.targetDate)}` : "Move over a calendar day") : `${formatRange(dragPreview.previewStart, dragPreview.previewEnd)} · release to save`}</span>
        </div>
      )}

      {message && <p className="scheduleMessage" role="status">{message}</p>}

      {form && (
        <div className="scheduleModalBackdrop" onMouseDown={(event) => event.target === event.currentTarget && setForm(null)}>
          <form className={`scheduleEditor ${form.kind === "holiday" ? "holidayEditor" : ""}`} onSubmit={saveEntry}>
            <div className="scheduleEditorHeading"><div><p>{form.kind === "holiday" ? form.id ? "Edit time away" : "Team availability" : form.id ? "Edit attendance" : "Quick booking"}</p><h2>{form.kind === "holiday" ? `☀ ${form.title || "Holiday"}` : form.id ? jobMap.get(String(form.jobId))?.name || form.jobName : "Schedule a job"}</h2></div><button type="button" onClick={() => setForm(null)}>×</button></div>
            {form.kind !== "holiday" && <label>Job<select value={form.jobId} disabled={Boolean(form.id)} onChange={(event) => setForm({ ...form, jobId: event.target.value })}><option value="">Choose a job…</option>{activeJobs.map((job) => <option value={job.id} key={job.id}>{job.name}</option>)}</select></label>}
            <div className="scheduleDateGrid"><label>From<input type="date" value={form.startDate} onChange={(event) => setForm({ ...form, startDate: event.target.value, endDate: form.endDate < event.target.value ? event.target.value : form.endDate })} /></label><label>To<input type="date" min={form.startDate} value={form.endDate} onChange={(event) => setForm({ ...form, endDate: event.target.value })} /></label></div>
            {form.kind === "holiday" && <p className="scheduleHolidayPrompt">Who is away? Select one or more JNR team members.</p>}
            <div className="scheduleResourcePickers">
              {(form.kind === "holiday" ? RESOURCE_SECTIONS.slice(0, 1) : RESOURCE_SECTIONS).map(([field, kind, label]) => {
                const options = resources.filter((resource) => resource.kind === kind);
                if (!options.length) return null;
                return <fieldset key={field}><legend>{label}</legend><div>{options.map((resource) => { const selected = form[field]?.includes(String(resource.id)); return <button type="button" className={selected ? "selected" : ""} style={{ "--resource-colour": resource.colour }} onClick={() => toggleResource(field, String(resource.id))} key={resource.id}><i />{resource.name}</button>; })}</div></fieldset>;
              })}
            </div>
            <label>{form.kind === "holiday" ? "Holiday note" : "What are we doing?"} <span>optional</span><textarea rows="3" value={form.note || ""} onChange={(event) => setForm({ ...form, note: event.target.value })} placeholder={form.kind === "holiday" ? "Anything the office should know" : "e.g. Finish external blockwork"} /></label>
            {form.kind !== "holiday" && <details className="scheduleMore"><summary>More options</summary><div><label>Start time<input type="time" value={form.startTime || ""} onChange={(event) => setForm({ ...form, startTime: event.target.value })} /></label><label>End time<input type="time" value={form.endTime || ""} onChange={(event) => setForm({ ...form, endTime: event.target.value })} /></label><label>Status<select value={form.status || "planned"} onChange={(event) => setForm({ ...form, status: event.target.value })}><option value="planned">Planned</option><option value="confirmed">Confirmed</option><option value="completed">Completed</option></select></label></div></details>}
            <div className="scheduleEditorActions">{form.id ? <>{form.kind !== "holiday" && <button type="button" className="delay" onClick={() => setDelayForm({ entryId: form.id, date: isoDate(new Date()), reason: "Weather", note: "", pushForward: false })}>No attendance / delay</button>}<button type="button" className="danger" onClick={cancelEntry}>Remove {form.kind === "holiday" ? "holiday" : "booking"}</button></> : <span /> }<button type="submit" disabled={saving}>{saving ? "Saving…" : form.kind === "holiday" ? form.id ? "Save holiday" : "Add holiday" : form.id ? "Save booking" : "Add to schedule"}</button></div>
          </form>
        </div>
      )}

      {delayForm && (
        <div className="scheduleModalBackdrop"><form className="scheduleDelayEditor" onSubmit={saveDelay}><div className="scheduleEditorHeading"><div><p>Construction reality</p><h2>No attendance / delay</h2></div><button type="button" onClick={() => setDelayForm(null)}>×</button></div><label>Missed date<input type="date" value={delayForm.date} onChange={(event) => setDelayForm({ ...delayForm, date: event.target.value })} /></label><label>Reason<select value={delayForm.reason} onChange={(event) => setDelayForm({ ...delayForm, reason: event.target.value })}>{DELAY_REASONS.map((reason) => <option key={reason}>{reason}</option>)}</select></label><label>Note<textarea rows="3" value={delayForm.note} onChange={(event) => setDelayForm({ ...delayForm, note: event.target.value })} placeholder="Optional context" /></label><label className="schedulePush"><input type="checkbox" checked={delayForm.pushForward} onChange={(event) => setDelayForm({ ...delayForm, pushForward: event.target.checked })} /><span><strong>Push remaining booking by one working day</strong><small>This is optional and skips Saturday/Sunday.</small></span></label><div className="scheduleEditorActions"><button type="button" onClick={() => setDelayForm(null)}>Cancel</button><button type="submit" disabled={saving}>Log no attendance</button></div></form></div>
      )}

      {conflict && (
        <div className="scheduleModalBackdrop"><section className="scheduleConflict"><span className="scheduleConflictIcon">!</span><p>Schedule conflict</p><h2>{conflict.conflicts.length} resource clash{conflict.conflicts.length === 1 ? "" : "es"}</h2><div>{conflict.conflicts.map((item, index) => <article key={`${item.entryId}-${item.resourceId}-${index}`}><strong>{item.resourceName}</strong><span>Already on {item.jobName}</span><small>{formatRange(item.startDate, item.endDate)}</small></article>)}</div><p className="scheduleConflictNote">HQ will never silently move the other booking.</p><footer><button type="button" onClick={() => setConflict(null)}>Cancel change</button><button type="button" className="keep" onClick={keepConflict} disabled={saving}>Keep conflict</button></footer></section></div>
      )}
    </main>
  );
}

export default SchedulePage;
