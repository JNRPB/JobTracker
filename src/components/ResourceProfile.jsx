import { useEffect, useMemo, useState } from "react";
import "./ResourceProfile.css";

const API_BASE = "";

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(`${String(value).slice(0, 10)}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function money(value) {
  if (value === "" || value === null || value === undefined) return "—";
  return `£${Number(value || 0).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fieldsFor(resource) {
  const common = [
    ["mobile", "Mobile", "tel"],
    ["email", "Email", "email"],
    ["address", "Address", "text"],
    ["emergencyContact", "Emergency contact", "text"],
    ["availabilityNotes", "Availability notes", "text"],
  ];
  if (resource.kind === "team") return [["jobTitle", "Role / trade", "text"], ...common, ["qualificationsText", "Qualifications / tickets", "text"]];
  if (resource.kind === "subcontractor") return [
    ["name", "Name", "text"], ["companyName", "Trading / company name", "text"], ["trade", "Trade / category", "text"],
    ...common, ["dayRate", "Day rate", "number"], ["hourlyRate", "Hourly rate", "number"], ["utr", "UTR", "text"],
    ["cisDetails", "CIS status / details", "text"], ["insuranceExpiry", "Insurance expiry", "date"],
    ["qualificationsText", "Qualifications / tickets", "text"], ["internalRating", "Internal rating (1–5)", "number"],
  ];
  if (resource.kind === "vehicle") return [
    ["name", "Vehicle name", "text"], ["registration", "Registration", "text"], ["make", "Make", "text"], ["model", "Model", "text"],
    ["year", "Year", "number"], ["physicalColour", "Vehicle colour", "text"], ["vehicleType", "Type", "text"], ["ownership", "Ownership", "select"],
    ["assignedDriver", "Assigned driver", "text"], ["motExpiry", "MOT expiry", "date"], ["taxRenewal", "Tax renewal", "date"],
    ["insuranceExpiry", "Insurance expiry", "date"], ["serviceDueDate", "Service due", "date"], ["mileage", "Mileage", "number"],
  ];
  return [
    ["name", "Equipment name", "text"], ["category", "Category", "text"], ["manufacturer", "Manufacturer", "text"], ["model", "Model", "text"],
    ["serialNumber", "Serial number", "text"], ["purchaseDate", "Purchase date", "date"], ["purchasePrice", "Purchase price", "number"],
    ["ownership", "Ownership", "select"], ["condition", "Condition", "text"], ["storageLocation", "Storage location", "text"],
    ["inspectionDate", "Last inspection / service", "date"], ["nextInspectionDue", "Next inspection / service", "date"],
  ];
}

function ResourceProfile({ resourceId, navigate, currentUser }) {
  const [resource, setResource] = useState(null);
  const [schedule, setSchedule] = useState([]);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(null);
  const [message, setMessage] = useState("Loading resource…");
  const [saving, setSaving] = useState(false);
  const canEdit = currentUser?.role === "admin";

  async function load() {
    try {
      const response = await fetch(`${API_BASE}/api/resources/${encodeURIComponent(resourceId)}`);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not load this resource.");
      const loaded = {
        ...data.resource,
        qualificationsText: (data.resource.qualifications || []).join(", "),
      };
      setResource(loaded);
      setDraft(loaded);
      setSchedule(Array.isArray(data.schedule) ? data.schedule : []);
      setMessage("");
    } catch (error) {
      setMessage(error.message);
    }
  }

  useEffect(() => {
    load();
  }, [resourceId]);

  const today = new Date().toISOString().slice(0, 10);
  const upcoming = useMemo(() => schedule.filter((entry) => entry.status !== "cancelled" && entry.endDate >= today), [schedule, today]);
  const previous = useMemo(() => schedule.filter((entry) => entry.endDate < today || entry.status === "cancelled").reverse(), [schedule, today]);
  const nextBooking = upcoming[0];
  const currentHoliday = upcoming.find((entry) => entry.kind === "holiday" && entry.startDate <= today && entry.endDate >= today);

  async function save(event) {
    event.preventDefault();
    setSaving(true);
    setMessage("Saving profile…");
    try {
      const payload = {
        ...draft,
        qualifications: String(draft.qualificationsText || "").split(",").map((item) => item.trim()).filter(Boolean),
      };
      delete payload.qualificationsText;
      const response = await fetch(`${API_BASE}/api/resources/${encodeURIComponent(resourceId)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not save this resource.");
      setEditing(false);
      await load();
      setMessage("Profile saved.");
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSaving(false);
    }
  }

  async function upload(file, imageType) {
    if (!file) return;
    const body = new FormData();
    body.append("image", file);
    body.append("imageType", imageType);
    setMessage(`Uploading ${imageType} image…`);
    try {
      const response = await fetch(`${API_BASE}/api/resources/${encodeURIComponent(resourceId)}/image`, { method: "POST", body });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not upload the image.");
      await load();
      setMessage(`${imageType === "cover" ? "Cover" : "Profile"} image updated.`);
    } catch (error) {
      setMessage(error.message);
    }
  }

  if (!resource) {
    return <main className="resourceProfilePage"><p className="resourceProfileMessage">{message}</p></main>;
  }

  const subtitle = resource.kind === "team"
    ? resource.jobTitle || "JNR team"
    : resource.kind === "subcontractor"
      ? [resource.trade, resource.companyName].filter(Boolean).join(" · ") || "Subcontractor"
      : resource.kind === "vehicle"
        ? [resource.registration, resource.make, resource.model].filter(Boolean).join(" · ") || "Vehicle"
        : [resource.category, resource.manufacturer, resource.model].filter(Boolean).join(" · ") || "Equipment";

  return (
    <main className="resourceProfilePage" style={{ "--resource-colour": resource.colour }}>
      <button type="button" className="resourceBack" onClick={() => navigate?.(canEdit ? "Settings" : "SchedulePage")}>← {canEdit ? "Resources" : "Schedule"}</button>

      <section className="resourceProfileHero">
        <div className="resourceCover">
          {resource.coverImageUrl ? <img src={resource.coverImageUrl} alt="" /> : <div className="resourceCoverFallback"><i /><i /><i /><span>JNR resource</span></div>}
          {canEdit && <label className="resourceUpload cover">Update cover<input type="file" accept="image/*" onChange={(event) => upload(event.target.files?.[0], "cover")} /></label>}
        </div>
        <div className="resourceHeroContent">
          <div className="resourceProfilePhoto">
            {resource.profileImageUrl ? <img src={resource.profileImageUrl} alt="" /> : <span>{resource.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}</span>}
            {canEdit && <label className="resourceUpload">Photo<input type="file" accept="image/*" onChange={(event) => upload(event.target.files?.[0], "profile")} /></label>}
          </div>
          <div className="resourceHeroIdentity"><p>{resource.kind}</p><h1>{resource.name}</h1><span>{subtitle}</span></div>
          <div className="resourceHeroActions"><span className={currentHoliday ? "holiday" : resource.active ? "active" : "inactive"}>{currentHoliday ? "On holiday" : resource.active ? "Available" : "Archived"}</span>{canEdit && <button type="button" onClick={() => { setDraft({ ...resource, qualificationsText: (resource.qualifications || []).join(", ") }); setEditing(true); }}>Edit profile</button>}<button type="button" onClick={() => navigate?.("SchedulePage")}>View schedule</button></div>
        </div>
      </section>

      <section className="resourceProfileStats">
        <div><span>Next booking</span><strong>{nextBooking ? formatDate(nextBooking.startDate) : "Nothing booked"}</strong><small>{nextBooking?.jobName || "Available"}</small></div>
        <div><span>Upcoming allocations</span><strong>{upcoming.length}</strong><small>live schedule entries</small></div>
        <div><span>Previous allocations</span><strong>{previous.length}</strong><small>operational history kept</small></div>
        <div><span>Schedule colour</span><strong className="resourceColourSample"><i />{resource.colour}</strong><small>used across HQ</small></div>
      </section>

      {message && <p className="resourceProfileMessage" role="status">{message}</p>}

      {editing && (
        <form className="resourceProfileEditor" onSubmit={save}>
          <div className="resourceProfileHeading"><div><p>Profile editor</p><h2>Resource details</h2></div><button type="button" onClick={() => setEditing(false)}>Cancel</button></div>
          <div className="resourceProfileFields">
            {fieldsFor(draft).map(([field, label, type]) => (
              <label key={field}>{label}
                {type === "select" ? (
                  <select value={draft[field] || ""} onChange={(event) => setDraft({ ...draft, [field]: event.target.value })}><option value="">Not recorded</option><option value="owned">Owned</option><option value="leased">Leased</option><option value="hired">Hired</option><option value="financed">Financed</option></select>
                ) : (
                  <input type={type} min={type === "number" ? "0" : undefined} step={type === "number" ? "0.01" : undefined} value={draft[field] ?? ""} disabled={resource.kind === "team" && field === "name"} onChange={(event) => setDraft({ ...draft, [field]: event.target.value })} />
                )}
              </label>
            ))}
            <label className="resourceProfileNotes">Internal notes<textarea rows="5" value={draft.notes || ""} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} /></label>
            <label className="resourceProfileCheck"><input type="checkbox" checked={draft.preferred === true} onChange={(event) => setDraft({ ...draft, preferred: event.target.checked })} /> Preferred resource</label>
            {resource.kind === "subcontractor" && <label className="resourceProfileCheck"><input type="checkbox" checked={draft.vatRegistered === true} onChange={(event) => setDraft({ ...draft, vatRegistered: event.target.checked })} /> VAT registered</label>}
            <label className="resourceProfileColour">Scheduling colour<input type="color" value={draft.colour || "#4f82ff"} onChange={(event) => setDraft({ ...draft, colour: event.target.value })} /></label>
          </div>
          <div className="resourceProfileSave"><span>Changes here do not alter the linked HQ login.</span><button type="submit" disabled={saving}>{saving ? "Saving…" : "Save profile"}</button></div>
        </form>
      )}

      <section className="resourceProfileGrid">
        <div className="resourceProfileMain">
          <article className="resourceProfileCard">
            <div className="resourceProfileHeading"><div><p>Forward plan</p><h2>Upcoming schedule</h2></div><button type="button" onClick={() => navigate?.("SchedulePage")}>Open board →</button></div>
            <div className="resourceBookingList">
              {upcoming.map((entry) => <article className={entry.kind === "holiday" ? "holiday" : ""} key={entry.id}><span className="resourceBookingDate"><strong>{formatDate(entry.startDate)}</strong><small>{entry.startDate === entry.endDate ? "One day" : `to ${formatDate(entry.endDate)}`}</small></span><span><strong>{entry.kind === "holiday" ? `☀ ${entry.jobName}` : entry.jobName}</strong><small>{entry.jobAddress || "No address saved"}</small><em>{entry.note || (entry.kind === "holiday" ? "Time away" : "General attendance")}</em></span><button type="button" onClick={() => navigate?.("SchedulePage")}>View</button></article>)}
              {!upcoming.length && <p className="resourceEmptyProfile">Nothing upcoming—this resource is currently available.</p>}
            </div>
          </article>
          <article className="resourceProfileCard">
            <div className="resourceProfileHeading"><div><p>History</p><h2>Previous allocations</h2></div></div>
            <div className="resourceBookingList compact">
              {previous.slice(0, 12).map((entry) => <article key={entry.id}><span className="resourceBookingDate"><strong>{formatDate(entry.startDate)}</strong><small>{entry.status}</small></span><span><strong>{entry.jobName}</strong><small>{entry.note || "No note"}</small></span></article>)}
              {!previous.length && <p className="resourceEmptyProfile">No previous bookings yet.</p>}
            </div>
          </article>
        </div>

        <aside className="resourceProfileAside">
          <article className="resourceProfileCard"><h2>Overview</h2><dl><div><dt>Type</dt><dd>{resource.kind}</dd></div><div><dt>Status</dt><dd>{resource.active ? "Active" : "Archived"}</dd></div><div><dt>Contact</dt><dd>{resource.mobile || resource.email || "—"}</dd></div>{resource.kind === "subcontractor" && <><div><dt>Day rate</dt><dd>{money(resource.dayRate)}</dd></div><div><dt>VAT registered</dt><dd>{resource.vatRegistered ? "Yes" : "No"}</dd></div></>} {resource.kind === "vehicle" && <><div><dt>MOT</dt><dd>{formatDate(resource.motExpiry)}</dd></div><div><dt>Service due</dt><dd>{formatDate(resource.serviceDueDate)}</dd></div></>} {resource.kind === "equipment" && <><div><dt>Condition</dt><dd>{resource.condition || "—"}</dd></div><div><dt>Next inspection</dt><dd>{formatDate(resource.nextInspectionDue)}</dd></div></>}</dl></article>
          <article className="resourceProfileCard"><h2>Notes</h2><p>{resource.notes || "No internal notes recorded."}</p></article>
          <article className="resourceProfileCard"><h2>Compliance &amp; documents</h2><p>{resource.qualifications?.length ? resource.qualifications.join(" · ") : "No qualifications or tickets recorded yet."}</p><small>Document upload can be connected to the existing Files system later without changing this profile model.</small></article>
        </aside>
      </section>
    </main>
  );
}

export default ResourceProfile;
