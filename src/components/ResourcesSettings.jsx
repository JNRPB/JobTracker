import { useEffect, useMemo, useState } from "react";
import "./ResourcesSettings.css";

const API_BASE = "";
const TABS = [
  { id: "team", label: "Team", singular: "team member" },
  { id: "subcontractor", label: "Subcontractors", singular: "subcontractor" },
  { id: "vehicle", label: "Vehicles", singular: "vehicle" },
  { id: "equipment", label: "Equipment", singular: "equipment item" },
];
const COLOURS = ["#4f82ff", "#27c982", "#f1b94c", "#ec6f91", "#9a78ff", "#3dc4d9", "#f47c48", "#a8c95f"];

function blankResource(kind) {
  return {
    id: "",
    kind,
    name: "",
    companyName: "",
    trade: "",
    category: "",
    mobile: "",
    email: "",
    registration: "",
    make: "",
    model: "",
    dayRate: "",
    hourlyRate: "",
    jobTitle: "",
    colour: "#4f82ff",
    active: true,
    preferred: false,
    vatRegistered: false,
    notes: "",
  };
}

function resourceSubtitle(resource) {
  if (resource.kind === "team") return resource.jobTitle || `@${resource.username || "team"}`;
  if (resource.kind === "subcontractor") return resource.trade || resource.companyName || "Subcontractor";
  if (resource.kind === "vehicle") return [resource.registration, resource.make, resource.model].filter(Boolean).join(" · ") || "Vehicle";
  return [resource.category, resource.manufacturer, resource.model].filter(Boolean).join(" · ") || "Equipment";
}

function ResourcesSettings({ navigate }) {
  const [resources, setResources] = useState([]);
  const [tab, setTab] = useState("team");
  const [form, setForm] = useState(null);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  async function loadResources() {
    try {
      const response = await fetch(`${API_BASE}/api/resources?includeArchived=true`);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not load resources.");
      setResources(Array.isArray(data.resources) ? data.resources : []);
    } catch (error) {
      setMessage(error.message);
    }
  }

  useEffect(() => {
    loadResources();
  }, []);

  const visibleResources = useMemo(
    () => resources.filter((resource) => resource.kind === tab),
    [resources, tab],
  );
  const tabMeta = TABS.find((item) => item.id === tab) || TABS[0];

  function edit(resource) {
    setForm({ ...blankResource(resource.kind), ...resource });
    setMessage("");
  }

  async function save(event) {
    event.preventDefault();
    if (!form?.name?.trim()) {
      setMessage("Add a name first.");
      return;
    }
    setSaving(true);
    setMessage(form.id ? "Saving resource…" : "Creating resource…");
    try {
      const response = await fetch(
        form.id ? `${API_BASE}/api/resources/${encodeURIComponent(form.id)}` : `${API_BASE}/api/resources`,
        {
          method: form.id ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not save this resource.");
      await loadResources();
      setForm(null);
      setMessage(`${data.resource?.name || "Resource"} saved.`);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSaving(false);
    }
  }

  async function archive(resource) {
    if (!window.confirm(`Archive ${resource.name}? Existing schedule history will be kept.`)) return;
    try {
      const response = await fetch(`${API_BASE}/api/resources/${encodeURIComponent(resource.id)}`, { method: "DELETE" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not archive this resource.");
      await loadResources();
      setMessage(`${resource.name} archived.`);
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function restore(resource) {
    try {
      const response = await fetch(`${API_BASE}/api/resources/${encodeURIComponent(resource.id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: true }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not restore this resource.");
      await loadResources();
      setMessage(`${resource.name} restored.`);
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function uploadImage(resource, file, imageType) {
    if (!file) return;
    const body = new FormData();
    body.append("image", file);
    body.append("imageType", imageType);
    setMessage(`Uploading ${imageType} image…`);
    try {
      const response = await fetch(`${API_BASE}/api/resources/${encodeURIComponent(resource.id)}/image`, {
        method: "POST",
        body,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not upload the image.");
      await loadResources();
      setMessage(`${resource.name}'s ${imageType} image updated.`);
    } catch (error) {
      setMessage(error.message);
    }
  }

  return (
    <article className="settingsCard full resourceSettingsCard">
      <div className="settingsCardTitle resourceSettingsTitle">
        <div>
          <h3>Resources</h3>
          <p>People, subcontractors, vehicles and major equipment available to the JNR schedule.</p>
        </div>
        {tab !== "team" && !form && (
          <button type="button" className="resourcePrimary" onClick={() => setForm(blankResource(tab))}>
            + Add {tabMeta.singular}
          </button>
        )}
      </div>

      <div className="resourceTabs" role="tablist" aria-label="Resource categories">
        {TABS.map((item) => {
          const count = resources.filter((resource) => resource.kind === item.id && resource.active).length;
          return (
            <button type="button" className={tab === item.id ? "active" : ""} onClick={() => { setTab(item.id); setForm(null); }} key={item.id}>
              {item.label}<span>{count}</span>
            </button>
          );
        })}
      </div>

      {form && (
        <form className="resourceEditor" onSubmit={save}>
          <div className="resourceEditorHeading">
            <div><strong>{form.id ? `Edit ${form.name}` : `New ${tabMeta.singular}`}</strong><span>Only the useful day-to-day details are shown here; the full profile carries the rest.</span></div>
            <button type="button" onClick={() => setForm(null)}>Cancel</button>
          </div>
          <div className="resourceEditorGrid">
            <label>Name<input value={form.name} disabled={form.kind === "team"} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
            {form.kind === "team" && <label>Role / trade<input value={form.jobTitle} onChange={(event) => setForm({ ...form, jobTitle: event.target.value })} placeholder="e.g. Plasterer" /></label>}
            {form.kind === "subcontractor" && <><label>Trading name<input value={form.companyName} onChange={(event) => setForm({ ...form, companyName: event.target.value })} /></label><label>Trade<input value={form.trade} onChange={(event) => setForm({ ...form, trade: event.target.value })} placeholder="e.g. Electrician" /></label></>}
            {form.kind === "vehicle" && <><label>Registration<input value={form.registration} onChange={(event) => setForm({ ...form, registration: event.target.value.toUpperCase() })} /></label><label>Make / model<input value={[form.make, form.model].filter(Boolean).join(" ")} onChange={(event) => setForm({ ...form, make: event.target.value, model: "" })} /></label></>}
            {form.kind === "equipment" && <><label>Category<input value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} placeholder="e.g. Mixer" /></label><label>Manufacturer / model<input value={[form.manufacturer, form.model].filter(Boolean).join(" ")} onChange={(event) => setForm({ ...form, manufacturer: event.target.value, model: "" })} /></label></>}
            {(form.kind === "team" || form.kind === "subcontractor") && <><label>Mobile<input value={form.mobile} onChange={(event) => setForm({ ...form, mobile: event.target.value })} /></label><label>Email<input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label></>}
            {form.kind === "subcontractor" && <><label>Day rate<input type="number" min="0" step="0.01" value={form.dayRate} onChange={(event) => setForm({ ...form, dayRate: event.target.value })} /></label><label className="resourceCheck"><input type="checkbox" checked={form.vatRegistered} onChange={(event) => setForm({ ...form, vatRegistered: event.target.checked })} /> VAT registered</label></>}
            <label className="resourceColourField">Schedule colour<div className="resourceColourChoices">{COLOURS.map((colour) => <button aria-label={`Use ${colour}`} type="button" className={form.colour === colour ? "selected" : ""} style={{ "--resource-colour": colour }} onClick={() => setForm({ ...form, colour })} key={colour} />)}<input type="color" value={form.colour} onChange={(event) => setForm({ ...form, colour: event.target.value })} /></div></label>
            <label className="resourceCheck"><input type="checkbox" checked={form.active !== false} onChange={(event) => setForm({ ...form, active: event.target.checked })} /> Active and available</label>
          </div>
          <div className="resourceEditorActions"><span>{message}</span><button type="submit" disabled={saving}>{saving ? "Saving…" : "Save resource"}</button></div>
        </form>
      )}

      {message && !form && <p className="resourceMessage" role="status">{message}</p>}

      <div className="resourceCardGrid">
        {visibleResources.map((resource) => (
          <article className={`resourceMiniCard ${resource.active ? "" : "archived"}`} style={{ "--resource-colour": resource.colour }} key={resource.id}>
            <div className="resourceMiniVisual">
              {resource.profileImageUrl ? <img src={resource.profileImageUrl} alt="" /> : <span>{resource.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}</span>}
            </div>
            <div className="resourceMiniIdentity">
              <strong>{resource.name}</strong>
              <span>{resourceSubtitle(resource)}</span>
              <small>{resource.active ? "Available" : "Archived"}</small>
            </div>
            <div className="resourceMiniActions">
              <button type="button" onClick={() => navigate?.("ResourceProfile", { resourceId: resource.id })}>Open profile</button>
              <button type="button" onClick={() => edit(resource)}>Edit</button>
              <label>Photo<input type="file" accept="image/*" onChange={(event) => uploadImage(resource, event.target.files?.[0], "profile")} /></label>
              <label>Cover<input type="file" accept="image/*" onChange={(event) => uploadImage(resource, event.target.files?.[0], "cover")} /></label>
              {resource.kind !== "team" && (resource.active ? <button type="button" className="danger" onClick={() => archive(resource)}>Archive</button> : <button type="button" onClick={() => restore(resource)}>Restore</button>)}
            </div>
          </article>
        ))}
        {!visibleResources.length && <div className="resourceEmpty"><strong>No {tabMeta.label.toLowerCase()} yet</strong><span>Add the first one when it becomes useful to schedule.</span></div>}
      </div>
    </article>
  );
}

export default ResourcesSettings;
