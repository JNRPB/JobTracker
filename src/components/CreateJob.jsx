import { useState } from "react";
import "./CreateJob.css";
import JobColourPicker from "./JobColourPicker";

const INITIAL_FORM = {
  name: "",
  clientName: "",
  clientPhone: "",
  clientEmail: "",
  siteAddress: "",
  postcode: "",
  jobType: "General building",
  status: "Lead",
  color: "#4f7cff",
  source: "",
  startDate: "",
  targetEndDate: "",
  notes: "",
};

const STATUS_OPTIONS = [
  "Lead",
  "Contacted",
  "To-Quote",
  "Quoted",
  "Accepted",
  "Approved",
  "Booked",
  "In Progress",
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

function CreateJob({ addJob, navigate }) {
  const [formData, setFormData] = useState(INITIAL_FORM);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  function handleChange(event) {
    const { name, value } = event.target;

    setFormData((current) => ({
      ...current,
      [name]: name === "postcode" ? value.toUpperCase() : value,
    }));

    if (error) setError("");
  }

  function cancel() {
    navigate?.("JobStatusOverview");
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const name = formData.name.trim();
    const clientName = formData.clientName.trim();
    const siteAddress = formData.siteAddress.trim();
    const postcode = formData.postcode.trim().toUpperCase();

    if (!name || !clientName) {
      setError("Add a job name and client name before creating the job.");
      return;
    }

    if (
      formData.startDate &&
      formData.targetEndDate &&
      formData.targetEndDate < formData.startDate
    ) {
      setError("The target finish date cannot be before the start date.");
      return;
    }

    if (typeof addJob !== "function") {
      setError("Job saving is not available on this screen.");
      return;
    }

    const now = new Date().toISOString();
    const newJob = {
      id: Date.now(),
      name,

      // Keep both names while older parts of HQ still use `client`.
      clientName,
      client: clientName,
      clientPhone: formData.clientPhone.trim(),
      clientEmail: formData.clientEmail.trim(),

      // `address` remains ready for the existing job list and geofence screen.
      address: [siteAddress, postcode].filter(Boolean).join(", "),
      siteAddress,
      postcode,

      jobType: formData.jobType,
      status: formData.status,
      color: formData.color,
      source: formData.source,
      startDate: formData.startDate,
      targetEndDate: formData.targetEndDate,
      notes: formData.notes.trim(),

      archived: false,
      quoteTotal: 0,
      phases: [],
      actualCosts: [],
      quotes: [],
      invoices: [],

      createdAt: now,
      updatedAt: now,
    };

    try {
      setIsSaving(true);
      setError("");

      const result = await Promise.resolve(addJob(newJob));
      const savedJob = result && typeof result === "object" ? result : newJob;
      const savedJobId = savedJob.id ?? newJob.id;

      navigate?.("JobCard", { jobId: savedJobId });
    } catch (saveError) {
      console.error("Failed to create job:", saveError);
      setError("The job could not be saved. Please try again.");
      setIsSaving(false);
    }
  }

  return (
    <main className="create-job-page">
      <div className="create-job-shell">
        <div className="create-job-heading">
          <div>
            <button className="create-job-back" type="button" onClick={cancel}>
              ← Jobs
            </button>
            <h1>Create a new job</h1>
            <p>
              Add the essentials now. Quotes, costs, files and the geofence live
              inside the job once it has been created.
            </p>
          </div>

          <span className="create-job-status-pill">New job</span>
        </div>

        <form
          className="create-job-form"
          style={{ "--job-colour": formData.color }}
          onSubmit={handleSubmit}
        >
          {error && (
            <div className="create-job-error" role="alert">
              {error}
            </div>
          )}

          <section className="create-job-section">
            <div className="create-job-section-heading">
              <span>01</span>
              <div>
                <h2>Job details</h2>
                <p>What the work is and where it sits in the pipeline.</p>
              </div>
            </div>

            <div className="create-job-grid create-job-grid-two">
              <label className="create-job-field create-job-field-wide">
                <span>Job name *</span>
                <input
                  autoFocus
                  name="name"
                  placeholder="e.g. Smith rear extension"
                  value={formData.name}
                  onChange={handleChange}
                  required
                />
              </label>

              <label className="create-job-field">
                <span>Job type</span>
                <select
                  name="jobType"
                  value={formData.jobType}
                  onChange={handleChange}
                >
                  {JOB_TYPE_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>

              <label className="create-job-field">
                <span>Status</span>
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                >
                  {STATUS_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>

              <div className="create-job-field create-job-field-wide">
                <span>Job colour</span>
                <JobColourPicker
                  value={formData.color}
                  onChange={(color) =>
                    setFormData((current) => ({ ...current, color }))
                  }
                  id="create-job-colour"
                />
              </div>
            </div>
          </section>

          <section className="create-job-section">
            <div className="create-job-section-heading">
              <span>02</span>
              <div>
                <h2>Client</h2>
                <p>The main person for this job.</p>
              </div>
            </div>

            <div className="create-job-grid create-job-grid-two">
              <label className="create-job-field create-job-field-wide">
                <span>Client name *</span>
                <input
                  autoComplete="name"
                  name="clientName"
                  placeholder="Full name or company"
                  value={formData.clientName}
                  onChange={handleChange}
                  required
                />
              </label>

              <label className="create-job-field">
                <span>Phone</span>
                <input
                  autoComplete="tel"
                  inputMode="tel"
                  name="clientPhone"
                  placeholder="07..."
                  value={formData.clientPhone}
                  onChange={handleChange}
                />
              </label>

              <label className="create-job-field">
                <span>Email</span>
                <input
                  autoComplete="email"
                  name="clientEmail"
                  placeholder="name@example.com"
                  type="email"
                  value={formData.clientEmail}
                  onChange={handleChange}
                />
              </label>
            </div>
          </section>

          <section className="create-job-section">
            <div className="create-job-section-heading">
              <span>03</span>
              <div>
                <h2>Site</h2>
                <p>Used by the job card, journeys and geofence setup.</p>
              </div>
            </div>

            <div className="create-job-grid create-job-grid-address">
              <label className="create-job-field">
                <span>Site address</span>
                <textarea
                  autoComplete="street-address"
                  name="siteAddress"
                  placeholder="House number, street and town"
                  rows="3"
                  value={formData.siteAddress}
                  onChange={handleChange}
                />
              </label>

              <label className="create-job-field">
                <span>Postcode</span>
                <input
                  autoComplete="postal-code"
                  name="postcode"
                  placeholder="LE13 1AA"
                  value={formData.postcode}
                  onChange={handleChange}
                />
              </label>
            </div>
          </section>

          <section className="create-job-section">
            <div className="create-job-section-heading">
              <span>04</span>
              <div>
                <h2>Planning</h2>
                <p>Optional dates, lead source and anything useful to remember.</p>
              </div>
            </div>

            <div className="create-job-grid create-job-grid-three">
              <label className="create-job-field">
                <span>Proposed start</span>
                <input
                  name="startDate"
                  type="date"
                  value={formData.startDate}
                  onChange={handleChange}
                />
              </label>

              <label className="create-job-field">
                <span>Target finish</span>
                <input
                  min={formData.startDate || undefined}
                  name="targetEndDate"
                  type="date"
                  value={formData.targetEndDate}
                  onChange={handleChange}
                />
              </label>

              <label className="create-job-field">
                <span>Lead source</span>
                <select
                  name="source"
                  value={formData.source}
                  onChange={handleChange}
                >
                  <option value="">Not recorded</option>
                  {SOURCE_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>

              <label className="create-job-field create-job-field-wide">
                <span>Initial notes</span>
                <textarea
                  name="notes"
                  placeholder="Scope, access, promises made, next action..."
                  rows="4"
                  value={formData.notes}
                  onChange={handleChange}
                />
              </label>
            </div>
          </section>

          <div className="create-job-actions">
            <p>* Required fields</p>

            <div>
              <button
                className="create-job-cancel"
                type="button"
                onClick={cancel}
                disabled={isSaving}
              >
                Cancel
              </button>

              <button
                className="create-job-submit"
                type="submit"
                disabled={isSaving}
              >
                {isSaving ? "Creating…" : "Create job →"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </main>
  );
}

export default CreateJob;
