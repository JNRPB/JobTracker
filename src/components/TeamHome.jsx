import { useEffect, useMemo, useState } from "react";
import "./TeamHome.css";
import { getJobColour } from "./jobColour";

const API_BASE = "";

function dateKey() {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(value, withYear = false) {
  if (!value) return "Not scheduled";
  const date = new Date(`${value}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return "Not scheduled";
  return date.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    ...(withYear ? { year: "numeric" } : {}),
  });
}

function dateRange(entry) {
  if (!entry) return "Not scheduled";
  return entry.startDate === entry.endDate
    ? formatDate(entry.startDate)
    : `${formatDate(entry.startDate)} – ${formatDate(entry.endDate)}`;
}

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function mapsUrl(job) {
  const lat = Number(job.location?.lat);
  const lng = Number(job.location?.lng);
  const query = Number.isFinite(lat) && Number.isFinite(lng)
    ? `${lat},${lng}`
    : job.address || [job.siteAddress, job.postcode].filter(Boolean).join(", ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

function documentKind(document) {
  const name = String(document.name || "").toLowerCase();
  if (name.endsWith(".pdf")) return "pdf";
  if (/\.(jpe?g|png|webp|gif)$/.test(name)) return "image";
  return "file";
}

function TeamHome({ jobs = [], currentUser, onRefresh }) {
  const [selectedId, setSelectedId] = useState("");
  const [todoText, setTodoText] = useState("");
  const [todoHigh, setTodoHigh] = useState(false);
  const [issueText, setIssueText] = useState("");
  const [showComposer, setShowComposer] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [holidays, setHolidays] = useState([]);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE}/api/my-work/holidays`)
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || "Could not load holiday information.");
        if (!cancelled) setHolidays(Array.isArray(data.holidays) ? data.holidays : []);
      })
      .catch((error) => {
        if (!cancelled) setMessage(error.message);
      });
    return () => { cancelled = true; };
  }, [currentUser?.id]);

  const sortedJobs = useMemo(() => [...jobs].sort((a, b) => {
    const aNext = (a.schedule || []).find((entry) => entry.endDate >= dateKey())?.startDate || "9999-12-31";
    const bNext = (b.schedule || []).find((entry) => entry.endDate >= dateKey())?.startDate || "9999-12-31";
    if (aNext !== bNext) return aNext.localeCompare(bNext);
    return String(a.name || "").localeCompare(String(b.name || ""));
  }), [jobs]);

  useEffect(() => {
    if (!sortedJobs.length) {
      setSelectedId("");
      return;
    }
    if (!sortedJobs.some((job) => String(job.id) === String(selectedId))) {
      setSelectedId(String(sortedJobs[0].id));
    }
  }, [sortedJobs, selectedId]);

  const selectedIndex = Math.max(0, sortedJobs.findIndex((job) => String(job.id) === String(selectedId)));
  const selected = sortedJobs[selectedIndex] || null;
  const today = dateKey();
  const currentHoliday = holidays.find((holiday) => holiday.startDate <= today && holiday.endDate >= today);
  const upcomingHoliday = holidays.find((holiday) => holiday.startDate > today);
  const firstName = currentUser?.displayName?.split(" ")[0] || "team";
  const holidayNotice = currentHoliday ? (
    <section className="teamHolidayBanner current">
      <span className="teamHolidayIcon">☀</span>
      <div><p>You’re on holiday</p><h2>Have a good time, {firstName}.</h2><span>HQ has marked you away {dateRange(currentHoliday)}. No work is expected from you today.</span></div>
      <strong>{currentHoliday.endDate === today ? "Back tomorrow" : `Back after ${formatDate(currentHoliday.endDate)}`}</strong>
    </section>
  ) : upcomingHoliday ? (
    <section className="teamHolidayBanner upcoming">
      <span className="teamHolidayIcon">☀</span>
      <div><p>Holiday booked</p><h2>Your time away is in the diary.</h2><span>{dateRange(upcomingHoliday)}{upcomingHoliday.note ? ` · ${upcomingHoliday.note}` : ""}</span></div>
      <strong>{formatDate(upcomingHoliday.startDate)}</strong>
    </section>
  ) : null;
  const personalTodos = (selected?.todos || []).filter((todo) => !todo.completed && todo.assignedToRole !== "admin");
  const allPersonalTodos = sortedJobs.flatMap((job) => (job.todos || []).filter((todo) => !todo.completed && todo.assignedToRole !== "admin").map((todo) => ({ ...todo, jobId: job.id, jobName: job.name })));
  const todayEntries = sortedJobs.flatMap((job) => (job.schedule || []).filter((entry) => entry.startDate <= today && entry.endDate >= today).map((entry) => ({ ...entry, jobId: job.id, jobName: job.name, address: job.address })));
  const upcomingEntries = sortedJobs.flatMap((job) => (job.schedule || []).filter((entry) => entry.startDate > today).map((entry) => ({ ...entry, jobId: job.id, jobName: job.name }))).sort((a, b) => a.startDate.localeCompare(b.startDate));
  const nextAttendance = (selected?.schedule || []).find((entry) => entry.endDate >= today);

  async function todoAction(jobId, body, successMessage) {
    setSaving(true);
    setMessage("Saving…");
    try {
      const response = await fetch(`${API_BASE}/api/my-work/jobs/${encodeURIComponent(jobId)}/todos`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not update this job.");
      await onRefresh?.();
      setMessage(successMessage);
      return true;
    } catch (error) {
      setMessage(error.message);
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function addTodo(event) {
    event.preventDefault();
    if (!todoText.trim() || !selected) return;
    const saved = await todoAction(selected.id, { action: "add", text: todoText, highImportance: todoHigh }, "TODO added.");
    if (saved) {
      setTodoText("");
      setTodoHigh(false);
      setShowComposer("");
    }
  }

  async function reportIssue(event) {
    event.preventDefault();
    if (!issueText.trim() || !selected) return;
    const saved = await todoAction(selected.id, { action: "report_issue", text: issueText }, "Josh has been notified.");
    if (saved) {
      setIssueText("");
      setShowComposer("");
    }
  }

  function step(direction) {
    if (!sortedJobs.length) return;
    const next = (selectedIndex + direction + sortedJobs.length) % sortedJobs.length;
    setSelectedId(String(sortedJobs[next].id));
  }

  if (!selected) {
    return (
      <main className="teamHome">
        <header className="teamWelcome">
          <div><p>JNR site workspace</p><h1>{greeting()}, {firstName}.</h1><span>Your work and availability, kept simple.</span></div>
          <div className="teamToday"><span>Today</span><strong>{new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}</strong></div>
        </header>
        {holidayNotice}
        <section className="teamEmpty">
          <span>JNR My Work</span>
          <h1>Nothing assigned yet</h1>
          <p>Your account is ready. Josh can assign a job from its Job Overview or put you onto a booking in Schedule.</p>
          <button type="button" onClick={() => onRefresh?.()}>Check again</button>
        </section>
      </main>
    );
  }

  const crew = nextAttendance
    ? [...(nextAttendance.people || []), ...(nextAttendance.subcontractors || [])]
    : [];
  const kit = nextAttendance
    ? [...(nextAttendance.vehicles || []), ...(nextAttendance.equipment || [])]
    : [];

  return (
    <main className="teamHome">
      <header className="teamWelcome">
        <div><p>JNR site workspace</p><h1>{greeting()}, {firstName}.</h1><span>Here is the work that matters to you—no accounts, VAT or office noise.</span></div>
        <div className="teamToday"><span>Today</span><strong>{new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}</strong></div>
      </header>

      {holidayNotice}

      <section className="teamSummary">
        <button type="button"><span>Assigned sites</span><strong>{sortedJobs.length}</strong><small>available in My Work</small></button>
        <button type="button"><span>Open TODOs</span><strong>{allPersonalTodos.length}</strong><small>{allPersonalTodos.filter((todo) => todo.highImportance).length} high importance</small></button>
        <button type="button"><span>{currentHoliday ? "Availability" : "On today"}</span><strong>{currentHoliday ? "On holiday" : todayEntries.length}</strong><small>{currentHoliday ? dateRange(currentHoliday) : todayEntries.length ? todayEntries.map((entry) => entry.jobName).join(", ") : "No attendance booked"}</small></button>
        <button type="button"><span>Next up</span><strong>{upcomingEntries[0] ? formatDate(upcomingEntries[0].startDate) : "Clear"}</strong><small>{upcomingEntries[0]?.jobName || "Nothing else booked"}</small></button>
      </section>

      <section
        className="teamHero"
        style={{ "--job-colour": getJobColour(selected) }}
      >
        <div className="teamHeroMedia">
          {selected.coverImageAssetId ? <img src={`${API_BASE}/api/immich/thumbnail/${encodeURIComponent(selected.coverImageAssetId)}`} alt="" /> : <div className="teamHeroFallback"><i /><i /><span>JNR</span></div>}
          <div className="teamHeroShade" />
        </div>
        <div className="teamHeroCopy">
          <div><span className="teamJobPosition">{String(selectedIndex + 1).padStart(2, "0")} / {String(sortedJobs.length).padStart(2, "0")}</span><span className="teamStatus">{selected.status || "Not started"}</span></div>
          <p>Assigned job</p>
          <h2>{selected.name}</h2>
          <address>{selected.address || "No site address saved"}</address>
          <div className="teamHeroActions">
            <a href={mapsUrl(selected)} target="_blank" rel="noreferrer">Directions ↗</a>
            {selected.clientPhone && <a href={`tel:${selected.clientPhone}`}>Call {selected.clientName?.split(" ")[0] || "customer"}</a>}
          </div>
        </div>
        <article className="teamPlanCard">
          <div className="teamPlanHeading"><span>{nextAttendance?.startDate <= today && nextAttendance?.endDate >= today ? "Today's plan" : "Next attendance"}</span><strong>{dateRange(nextAttendance)}</strong></div>
          <div className="teamPlanGrid">
            <div><span>People</span><strong>{crew.length ? crew.join(" · ") : "You"}</strong></div>
            <div><span>Vehicle / equipment</span><strong>{kit.length ? kit.join(" · ") : "None allocated"}</strong></div>
            <div className="wide"><span>Plan</span><strong>{nextAttendance?.note || "General site attendance"}</strong></div>
          </div>
          {nextAttendance?.delays?.length > 0 && <p className="teamDelayNote">Latest delay: {nextAttendance.delays[nextAttendance.delays.length - 1].reason}</p>}
        </article>
        <div className="teamHeroNav"><button type="button" onClick={() => step(-1)}>←</button><div>{sortedJobs.map((job) => <button aria-label={`Show ${job.name}`} type="button" className={String(job.id) === String(selected.id) ? "active" : ""} style={{ "--dot-colour": getJobColour(job) }} onClick={() => setSelectedId(String(job.id))} key={job.id} />)}</div><button type="button" onClick={() => step(1)}>→</button></div>
      </section>

      {message && <p className="teamMessage" role="status">{message}</p>}

      <section className="teamGrid">
        <article className="teamCard teamTasks">
          <div className="teamCardHeading"><div><p>Next actions</p><h2>{selected.name} TODOs</h2></div><button type="button" onClick={() => setShowComposer(showComposer === "todo" ? "" : "todo")}>+ Add TODO</button></div>
          {showComposer === "todo" && <form className="teamComposer" onSubmit={addTodo}><input autoFocus value={todoText} onChange={(event) => setTodoText(event.target.value)} placeholder="What needs doing?" /><label><input type="checkbox" checked={todoHigh} onChange={(event) => setTodoHigh(event.target.checked)} /> High importance</label><button type="submit" disabled={saving || !todoText.trim()}>Add</button></form>}
          <div className="teamTaskList">
            {personalTodos.map((todo) => <article className={todo.highImportance ? "high" : ""} key={todo.id}><button type="button" disabled={saving} onClick={() => todoAction(selected.id, { action: "complete", todoId: todo.id }, "TODO completed.")}>✓</button><span><strong>{todo.text}</strong><small>{todo.highImportance ? "High importance" : todo.createdByName ? `Added by ${todo.createdByName}` : "Job TODO"}</small></span></article>)}
            {!personalTodos.length && <div className="teamAllClear"><i>✓</i><span><strong>All clear</strong><small>No outstanding actions on this site.</small></span></div>}
          </div>
          <div className="teamIssueBar"><span><strong>Something blocking the job?</strong><small>Send Josh a high-priority office TODO.</small></span><button type="button" onClick={() => setShowComposer(showComposer === "issue" ? "" : "issue")}>Report a problem</button></div>
          {showComposer === "issue" && <form className="teamComposer issue" onSubmit={reportIssue}><textarea autoFocus rows="3" value={issueText} onChange={(event) => setIssueText(event.target.value)} placeholder="Describe the problem clearly…" /><button type="submit" disabled={saving || !issueText.trim()}>Notify Josh</button></form>}
        </article>

        <aside className="teamCard teamContact">
          <div className="teamCardHeading"><div><p>Site details</p><h2>Useful now</h2></div></div>
          <dl><div><dt>Customer</dt><dd>{selected.clientName || "Not recorded"}</dd></div><div><dt>Job type</dt><dd>{selected.jobType || "General building"}</dd></div><div><dt>Start</dt><dd>{formatDate(selected.startDate, true)}</dd></div><div><dt>Target finish</dt><dd>{formatDate(selected.targetEndDate, true)}</dd></div></dl>
          {selected.notes && <div className="teamSiteNote"><span>Job note</span><p>{selected.notes}</p></div>}
          <a className="teamDirections" href={mapsUrl(selected)} target="_blank" rel="noreferrer">Open site in Maps ↗</a>
        </aside>
      </section>

      <section className="teamCard teamDocuments">
        <div className="teamCardHeading"><div><p>Site information</p><h2>Drawings &amp; documents</h2><span>Only practical job documents are shown here—never supplier costs or accounts.</span></div><strong>{selected.documents?.length || 0} files</strong></div>
        <div className="teamDocumentGrid">
          {(selected.documents || []).slice(0, 6).map((document) => {
            const kind = documentKind(document);
            return <article key={document.id}><div className="teamDocumentPreview">{kind === "pdf" && document.url ? <iframe src={`${document.url}#page=1&view=FitH`} title={`Preview ${document.name}`} /> : kind === "image" && document.url ? <img src={document.url} alt="" /> : <span>{String(document.category || "file").slice(0, 4).toUpperCase()}</span>}</div><div><span>{document.category}</span><strong title={document.name}>{document.name}</strong><small>{document.note || "Job document"}</small></div>{document.url && <a href={document.url} target="_blank" rel="noreferrer">Open original ↗</a>}</article>;
          })}
          {!selected.documents?.length && <div className="teamNoDocuments"><strong>No drawings or certificates linked yet</strong><span>They will appear here automatically when the office links them to this job.</span></div>}
        </div>
      </section>

      <section className="teamAssigned">
        <div className="teamSectionHeading"><div><p>Your sites</p><h2>All assigned work</h2></div><span>{sortedJobs.length} jobs</span></div>
        <div className="teamJobGrid">{sortedJobs.map((job) => {
          const next = (job.schedule || []).find((entry) => entry.endDate >= today);
          const todoCount = (job.todos || []).filter((todo) => !todo.completed && todo.assignedToRole !== "admin").length;
          return <button type="button" className={String(job.id) === String(selected.id) ? "selected" : ""} style={{ "--job-colour": getJobColour(job) }} onClick={() => { setSelectedId(String(job.id)); window.scrollTo({ top: 0, behavior: "smooth" }); }} key={job.id}><span className="teamJobImage">{job.coverImageAssetId ? <img src={`${API_BASE}/api/immich/thumbnail/${encodeURIComponent(job.coverImageAssetId)}`} alt="" /> : <i />}</span><span><em>{job.status || "Job"}</em><strong>{job.name}</strong><small>{job.address || "No address saved"}</small><span className="teamJobMeta"><b>{next ? dateRange(next) : "Not scheduled"}</b><b>{todoCount} TODO{todoCount === 1 ? "" : "s"}</b></span></span></button>;
        })}</div>
      </section>
    </main>
  );
}

export default TeamHome;
