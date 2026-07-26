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

const API_BASE = "";
const DEFAULT_CENTER = [52.7689, -0.9007];
const TRAVEL_COST_PER_MILE = 0.45;

function money(value) {
  return `£${Number(value || 0).toFixed(2)}`;
}

function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-GB", {
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

function blankCustomerDetails() {
  return {
    name: "",
    phone: "",
    email: "",
    address: "",
  };
}

function hasCustomerDetails(customerDetails) {
  return Boolean(
    customerDetails?.name?.trim() ||
    customerDetails?.phone?.trim() ||
    customerDetails?.email?.trim() ||
    customerDetails?.address?.trim(),
  );
}

function FlyToLocation({ location }) {
  const map = useMap();

  useEffect(() => {
    if (location?.lat && location?.lng) {
      map.flyTo([location.lat, location.lng], 17, { duration: 1.1 });
    }
  }, [location?.lat, location?.lng, map]);

  return null;
}

function JobPinPicker({ location, onPick }) {
  useMapEvents({
    click(e) {
      onPick({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });

  if (!location?.lat || !location?.lng) return null;

  return (
    <>
      <Marker position={[location.lat, location.lng]}>
        <Popup>Job geofence centre</Popup>
      </Marker>

      <Circle
        center={[location.lat, location.lng]}
        radius={Number(location.radiusMeters || 150)}
        pathOptions={{
          color: "#75e6a0",
          fillColor: "#75e6a0",
          fillOpacity: 0.2,
        }}
      />
    </>
  );
}

function JobOverview({
  job,
  onUpdate,
  onArchive,
  onUnarchive,
  navigate,
  fileCount = 0,
  fileLinkedCost = 0,
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
  const [immichPhotos, setImmichPhotos] = useState([]);
  const [tripLinks, setTripLinks] = useState([]);
  const printRef = useRef(null);

  useEffect(() => {
    setLocalJob(job);
    setEditableJob(job);
    setCustomerDetails(job?.customerDetails || blankCustomerDetails());
    setIsEditingJob(false);
    setEditingCustomer(false);
  }, [job]);

  useEffect(() => {
    if (job?.id) loadImmichPhotos(job.id);
  }, [job?.id]);

  useEffect(() => {
    async function fetchData() {
      try {
        const tripLinksRes = await fetch(`${API_BASE}/api/traccar/trip-links`);
        const tripLinksData = await tripLinksRes.json();
        setTripLinks(Array.isArray(tripLinksData) ? tripLinksData : []);
      } catch (err) {
        console.error("Failed to fetch trip data:", err);
      }
    }

    fetchData();
  }, []);

  async function loadImmichPhotos(jobId) {
    try {
      const res = await fetch(`${API_BASE}/api/immich/job/${jobId}`);
      const data = await res.json();
      setImmichPhotos(Array.isArray(data.links) ? data.links : []);
    } catch {
      setImmichPhotos([]);
    }
  }

  function updateEditableJob(field, value) {
    setEditableJob((prev) => ({ ...prev, [field]: value }));
  }

  function updateEditableLocation(nextLocation) {
    setEditableJob((prev) => ({
      ...prev,
      location: {
        ...(prev.location || {}),
        ...nextLocation,
      },
    }));
  }

  function cancelEditJob() {
    setEditableJob(localJob);
    setIsEditingJob(false);
    setJobMessage("");
  }

  async function saveJobDetails() {
    if (!editableJob?.name?.trim()) {
      setJobMessage("Add a job name before saving.");
      return;
    }

    setSavingJob(true);
    setJobMessage("Saving job details...");

    const nextAddress =
      editableJob.address || editableJob.location?.address || "";

    const nextJob = {
      ...localJob,
      ...editableJob,
      name: editableJob.name.trim(),
      address: nextAddress,
      location: {
        ...(localJob.location || {}),
        ...(editableJob.location || {}),
        address: nextAddress,
      },
      updatedAt: new Date().toISOString(),
    };

    try {
      const res = await fetch(`${API_BASE}/jobs/${localJob.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nextJob),
      });

      if (!res.ok) throw new Error("Save failed");

      const data = await res.json();
      const savedJob = data.job || data;

      setLocalJob(savedJob);
      setEditableJob(savedJob);
      if (onUpdate) onUpdate(savedJob);

      setIsEditingJob(false);
      setJobMessage("Job details saved.");
    } catch (err) {
      console.error(err);
      setJobMessage("Could not save job details.");
    } finally {
      setSavingJob(false);
    }
  }

  function updateLocation(nextLocation) {
    setLocalJob((prev) => ({
      ...prev,
      location: {
        ...(prev.location || {}),
        ...nextLocation,
      },
    }));
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
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(
          address,
        )}`,
      );

      const data = await res.json();

      if (!data?.length) {
        setLocationMessage("Address not found.");
        return;
      }

      const nextLocation = {
        lat: Number(data[0].lat),
        lng: Number(data[0].lon),
        radiusMeters: localJob.location?.radiusMeters || 150,
        address,
      };

      updateLocation(nextLocation);
      setLocationMessage("Address found. Pin moved to location.");
    } catch {
      setLocationMessage("Address search failed.");
    }
  }

  async function saveJobLocation() {
    if (!localJob.location?.lat || !localJob.location?.lng) {
      setLocationMessage("Search address or drop a pin first.");
      return;
    }

    setSavingLocation(true);

    try {
      const res = await fetch(`${API_BASE}/jobs/${localJob.id}/location`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lat: localJob.location.lat,
          lng: localJob.location.lng,
          radiusMeters: localJob.location.radiusMeters || 150,
          address: localJob.location.address || localJob.address || "",
        }),
      });

      if (!res.ok) throw new Error("Save failed");

      const data = await res.json();
      setLocalJob(data.job);
      setEditableJob(data.job);
      if (onUpdate) onUpdate(data.job);

      setLocationMessage("Geofence saved.");
    } catch {
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

    try {
      const res = await fetch(
        `${API_BASE}/jobs/${localJob.id}/customer-details`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(customerDetails),
        },
      );

      if (!res.ok) throw new Error("Failed to save customer details");

      const data = await res.json();
      const savedJob = data.job || { ...localJob, customerDetails };

      setLocalJob(savedJob);
      setEditableJob(savedJob);
      setCustomerDetails(savedJob.customerDetails || customerDetails);
      if (onUpdate) onUpdate(savedJob);

      setEditingCustomer(false);
      setCustomerMessage("Customer details saved.");
    } catch (err) {
      console.error(err);
      setCustomerMessage("Could not save customer details.");
    } finally {
      setSavingCustomer(false);
    }
  }

  function goToDocuments() {
    navigate("JobDocuments", { jobId: localJob.id });
  }

  function printOverview() {
    window.print();
  }

  const quoteTotal = Number(localJob.quote?.total || localJob.quoteTotal || 0);
  const costTotal = Number(fileLinkedCost || 0);
  const margin = quoteTotal - costTotal;
  const marginPercent = quoteTotal ? (margin / quoteTotal) * 100 : 0;

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

  const totalMiles = jobTripLinks.reduce((sum, link) => {
    return (
      sum + Number(link.miles || link.distanceMiles || link.totalMiles || 0)
    );
  }, 0);

  const travelCost = totalMiles * TRAVEL_COST_PER_MILE;
  const profitAfterTravel = margin - travelCost;
  const earnedPerDay = visitDays > 0 ? margin / visitDays : 0;
  const afterTravelPerDay = visitDays > 0 ? profitAfterTravel / visitDays : 0;

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

  const mapCenter =
    localJob.location?.lat && localJob.location?.lng
      ? [localJob.location.lat, localJob.location.lng]
      : DEFAULT_CENTER;

  const hasStarted = visitDays > 0 || localJob.status === "In Progress";

  return (
    <div className="jobOverviewPage" ref={printRef}>
      <section className="overviewHero job-standard-card profileHeroCard">
        <div className="profileHeroHeader">
          <div>
            <div className="overviewBreadcrumb">Jobs › Job Overview</div>
            <h2>Job Overview</h2>
          </div>

          {!isEditingJob && (
            <div className="overviewActions no-print">
              <button
                className="sleekButton ghostButton"
                onClick={() => navigate("JobStatusOverview")}
              >
                Back
              </button>

              <button
                className="sleekButton primaryButton"
                onClick={goToDocuments}
              >
                Documents
              </button>

              <button
                className="sleekButton ghostButton"
                onClick={() => {
                  setEditableJob(localJob);
                  setIsEditingJob(true);
                }}
              >
                Edit Job
              </button>

              <button
                className="sleekButton successButton printButton"
                onClick={printOverview}
              >
                🖨 Print Overview
              </button>
            </div>
          )}
        </div>

        {isEditingJob ? (
          <div className="jobEditHeroForm no-print">
            <label>
              Job Name
              <input
                value={editableJob.name || ""}
                onChange={(e) => updateEditableJob("name", e.target.value)}
                placeholder="Job name"
              />
            </label>

            <label>
              Job Address
              <input
                value={
                  editableJob.address || editableJob.location?.address || ""
                }
                onChange={(e) => {
                  updateEditableJob("address", e.target.value);
                  updateEditableLocation({ address: e.target.value });
                }}
                placeholder="Job address"
              />
            </label>

            <div className="jobEditInlineGrid">
              <label>
                Status
                <select
                  value={editableJob.status || "Not Started"}
                  onChange={(e) => updateEditableJob("status", e.target.value)}
                >
                  <option>Not Started</option>
                  <option>Quoted</option>
                  <option>Accepted</option>
                  <option>In Progress</option>
                  <option>Completed</option>
                  <option>On Hold</option>
                  <option>Archived</option>
                </select>
              </label>

              <label>
                Start Date
                <input
                  type="date"
                  value={dateInputValue(editableJob.startDate)}
                  onChange={(e) =>
                    updateEditableJob("startDate", e.target.value)
                  }
                />
              </label>
            </div>

            <label>
              Notes
              <textarea
                value={editableJob.notes || ""}
                onChange={(e) => updateEditableJob("notes", e.target.value)}
                placeholder="Job notes"
              />
            </label>

            {jobMessage && <p className="soft-text">{jobMessage}</p>}

            <div className="buttonRow">
              <button
                className="sleekButton successButton"
                onClick={saveJobDetails}
                disabled={savingJob}
              >
                {savingJob ? "Saving..." : "Save Job"}
              </button>

              <button
                className="sleekButton ghostButton"
                onClick={cancelEditJob}
                disabled={savingJob}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="profileDisplayBlock">
            <h1>{localJob.name || "Untitled Job"}</h1>
            <p className="profileDisplayLine bigLine">
              📍{" "}
              {localJob.address ||
                localJob.location?.address ||
                "No address set"}
            </p>

            <div className="profileMiniGrid">
              <InfoBox
                title="Start Date"
                value={formatDate(localJob.startDate)}
              />
              <InfoBox title="Last Visit" value={formatDate(lastVisit)} />
              <InfoBox
                title="Status"
                value={
                  hasStarted ? localJob.status || "In Progress" : "Not Started"
                }
              />
              <InfoBox title="Files" value={fileCount} />
            </div>

            {jobMessage && <p className="soft-text">{jobMessage}</p>}
          </div>
        )}
      </section>

      <section className="overviewMetricGrid">
        <DashboardCard
          title="Documents"
          value={`${(localJob.quotes || []).length} Quotes`}
          sub={`${(localJob.invoices || []).length} Invoices`}
          onClick={goToDocuments}
        />

        <DashboardCard
          title="Files"
          value={`${fileCount} Files`}
          sub={money(fileLinkedCost)}
          onClick={() => navigate("Files", { jobId: localJob.id })}
        />
        <DashboardCard
          title="Photos"
          value={`${immichPhotos.length}`}
          sub="Linked Images"
          onClick={() => {
            const photosSection = document.querySelector(".overviewPhotoGrid");
            photosSection?.scrollIntoView({
              behavior: "smooth",
              block: "center",
            });
          }}
        />

        <DashboardCard
          title="Trips"
          value={`${visitDays} Visits`}
          sub={`${totalMiles.toFixed(1)} miles`}
          onClick={() => navigate("JobHeatMap", { jobId: localJob.id })}
        />

        <DashboardCard
          title="Financial"
          value={money(profitAfterTravel)}
          sub="Profit After Travel"
          onClick={() => {
            const financialSection =
              document.querySelector(".overviewSideStack");
            financialSection?.scrollIntoView({
              behavior: "smooth",
              block: "start",
            });
          }}
        />
      </section>

      <section className="overviewDetailGrid no-print">
        <section className="job-standard-card profileHeroCard customerDetailsCard">
          <div className="profileHeroHeader">
            <div>
              <h2>Customer</h2>
              <p className="soft-text">Contact information for this job.</p>
            </div>

            {!editingCustomer && (
              <div className="buttonRow">
                <button
                  className="sleekButton ghostButton"
                  onClick={() => setEditingCustomer(true)}
                >
                  Edit
                </button>

                <button
                  className="sleekButton primaryButton"
                  onClick={goToDocuments}
                >
                  Documents
                </button>
              </div>
            )}
          </div>

          {!editingCustomer ? (
            <div className="profileDisplayBlock customerDisplayBlock">
              <h1>{localJob.customerDetails?.name || "No customer saved"}</h1>

              <p className="profileDisplayLine">
                📞 {localJob.customerDetails?.phone || "No phone saved"}
              </p>
              <p className="profileDisplayLine">
                ✉️ {localJob.customerDetails?.email || "No email saved"}
              </p>
              <p className="profileDisplayLine">
                📍{" "}
                {localJob.customerDetails?.address ||
                  "No customer address saved"}
              </p>

              {customerMessage && (
                <p className="soft-text">{customerMessage}</p>
              )}
            </div>
          ) : (
            <div className="customerEditForm">
              <label>
                Customer Name
                <input
                  value={customerDetails.name}
                  onChange={(e) =>
                    setCustomerDetails({
                      ...customerDetails,
                      name: e.target.value,
                    })
                  }
                  placeholder="Customer name"
                />
              </label>

              <label>
                Phone Number
                <input
                  value={customerDetails.phone}
                  onChange={(e) =>
                    setCustomerDetails({
                      ...customerDetails,
                      phone: e.target.value,
                    })
                  }
                  placeholder="Phone number"
                />
              </label>

              <label>
                Email Address
                <input
                  value={customerDetails.email}
                  onChange={(e) =>
                    setCustomerDetails({
                      ...customerDetails,
                      email: e.target.value,
                    })
                  }
                  placeholder="Email address"
                />
              </label>

              <label>
                Customer Address
                <textarea
                  value={customerDetails.address}
                  onChange={(e) =>
                    setCustomerDetails({
                      ...customerDetails,
                      address: e.target.value,
                    })
                  }
                  placeholder="Customer address"
                />
              </label>

              {customerMessage && (
                <p className="soft-text">{customerMessage}</p>
              )}

              <div className="buttonRow">
                <button
                  className="sleekButton successButton"
                  onClick={saveCustomerDetails}
                  disabled={savingCustomer}
                >
                  {savingCustomer ? "Saving..." : "Save Customer"}
                </button>

                <button
                  className="sleekButton ghostButton"
                  onClick={cancelCustomerEdit}
                  disabled={savingCustomer}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </section>
        <section className="job-standard-card quoteLaunchCard">
          <div className="profileHeroHeader">
            <div>
              <h2>Documents</h2>
              <p className="soft-text">
                Quotes, invoices, payments and future paperwork for this job.
              </p>
            </div>
          </div>

          <div className="quoteSummaryPanel">
            <SideRow label="Quotes" value={(localJob.quotes || []).length} />
            <SideRow
              label="Invoices"
              value={(localJob.invoices || []).length}
            />
            <SideRow
              label="Payments"
              value={(localJob.payments || []).length}
            />

            <hr className="jobCardDivider" />

            <SideRow
              label="Job Portal"
              value={localJob.portal?.enabled ? "Active" : "Not Created"}
            />

            {localJob.portal?.enabled ? (
              <a
                href={`/job-tracker/portal/${localJob.portal.token}`}
                target="_blank"
                rel="noopener noreferrer"
                className="sleekButton successButton"
                style={{
                  textDecoration: "none",
                  textAlign: "center",
                  display: "block",
                }}
              >
                Open Client Portal ↗
              </a>
            ) : (
              <button
                className="sleekButton ghostButton"
                onClick={async () => {
                  const updatedJob = {
                    ...localJob,
                    portal: {
                      enabled: true,
                      token: crypto.randomUUID(),
                      activity: [],
                    },
                  };

                  await onUpdate(updatedJob);

                  setLocalJob(updatedJob);
                }}
              >
                Generate Portal
              </button>
            )}

            <button
              className="sleekButton primaryButton"
              onClick={goToDocuments}
            >
              Open Documents
            </button>
          </div>
        </section>
      </section>

      <div className="overviewMainGrid">
        <main className="overviewMainStack">
          <section className="job-standard-card overviewMapPanel">
            <div className="panelTitleRow">
              <div>
                <h2>Location & Geofence</h2>
                <p className="soft-text">
                  Search an address or click the map to move the job pin.
                </p>
              </div>
            </div>

            <div className="geofenceSearch no-print">
              <input
                value={localJob.location?.address || localJob.address || ""}
                onChange={(e) => updateLocation({ address: e.target.value })}
                placeholder="Search address..."
              />

              <button
                className="sleekButton primaryButton"
                onClick={geocodeAddress}
              >
                Search Address
              </button>
            </div>

            <div className="largeJobMap">
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
                      radiusMeters: localJob.location?.radiusMeters || 150,
                      address:
                        localJob.location?.address || localJob.address || "",
                    })
                  }
                />
              </MapContainer>
            </div>

            <div className="geoInfoGrid">
              <InfoBox
                title="Latitude"
                value={localJob.location?.lat?.toFixed?.(6) || "—"}
              />
              <InfoBox
                title="Longitude"
                value={localJob.location?.lng?.toFixed?.(6) || "—"}
              />
              <InfoBox
                title="Radius"
                value={`${localJob.location?.radiusMeters || 150} m`}
              />
              <InfoBox
                title="Geofence"
                value={localJob.location?.lat ? "Active" : "Not set"}
              />
            </div>

            <div className="geofenceFooter no-print">
              <span>{locationMessage}</span>

              <button
                className="sleekButton successButton"
                onClick={saveJobLocation}
                disabled={savingLocation}
              >
                {savingLocation ? "Saving..." : "Save Geofence"}
              </button>
            </div>
          </section>

          <section className="job-standard-card">
            <h2>Recent Photos</h2>

            {immichPhotos.length > 0 ? (
              <div className="overviewPhotoGrid">
                {immichPhotos.slice(0, 6).map((photo) => (
                  <img
                    key={photo.assetId}
                    src={`${API_BASE}/api/immich/thumbnail/${photo.assetId}`}
                    alt={photo.originalFileName || "Job photo"}
                  />
                ))}
              </div>
            ) : (
              <div className="emptyOverviewBox">
                <strong>No photos linked yet</strong>
                <span>
                  Photos will appear once Immich links images to this job.
                </span>
              </div>
            )}
          </section>
        </main>

        <aside className="overviewSideStack">
          <section className="job-standard-card">
            <h2>Visit Summary</h2>
            <SideRow label="First Visit" value={formatDate(firstVisit)} />
            <SideRow label="Last Visit" value={formatDate(lastVisit)} />
            <SideRow label="Days Attended" value={`${visitDays} days`} />
            <SideRow
              label="Total Miles"
              value={`${totalMiles.toFixed(1)} miles`}
            />
            <SideRow
              label="Average Miles / Day"
              value={
                visitDays
                  ? `${(totalMiles / visitDays).toFixed(1)} miles`
                  : "0 miles"
              }
            />
          </section>

          <section className="job-standard-card">
            <h2>Team Performance</h2>
            <SideRow label="Earned Per Day" value={money(earnedPerDay)} />
            <SideRow
              label="After Travel / Day"
              value={money(afterTravelPerDay)}
            />
            <SideRow
              label="Callum Days Worked"
              value={`${localJob.callumDays || 0} days`}
            />
            <SideRow
              label="Labour Remaining"
              value={money(localJob.labourRemaining || 0)}
            />
          </section>

          <section className="job-standard-card">
            <h2>Notes</h2>
            <div className="overviewNotes">
              {localJob.notes || "No notes added yet."}
            </div>
          </section>

          <section className="job-standard-card">
            <h2>Job Info</h2>
            <SideRow label="Files" value={fileCount} />
            <SideRow label="Photos" value={immichPhotos.length} />
            <SideRow label="Status" value={localJob.status || "Not Started"} />
          </section>

          <section className="job-standard-card no-print">
            <h2>Job Actions</h2>
            {localJob.archived ? (
              <button
                className="sleekButton successButton"
                onClick={() => onUnarchive?.(localJob)}
              >
                Unarchive Job
              </button>
            ) : (
              <button
                className="sleekButton ghostButton"
                onClick={() => onArchive?.(localJob)}
              >
                Archive Job
              </button>
            )}
          </section>
        </aside>
      </div>

      <section className="printOnly printReport">
        <div className="printHeader">
          <img src={logo} alt="JNR logo" />
          <div>
            <h1>Job Overview Report</h1>
            <p>Generated {formatDate(new Date())}</p>
          </div>
        </div>

        <h2>{localJob.name}</h2>
        <p>{localJob.address || localJob.location?.address}</p>

        <div className="printGrid">
          <InfoBox title="Quote Total" value={money(quoteTotal)} />
          <InfoBox title="Costs" value={money(costTotal)} />
          <InfoBox title="Gross Margin" value={money(margin)} />
          <InfoBox
            title="Profit After Travel"
            value={money(profitAfterTravel)}
          />
          <InfoBox title="Days Attended" value={visitDays} />
          <InfoBox title="Total Miles" value={`${totalMiles.toFixed(1)} mi`} />
        </div>

        <h3>Customer</h3>
        <p>{localJob.customerDetails?.name || "No customer saved."}</p>

        <h3>Notes</h3>
        <p>{localJob.notes || "No notes added."}</p>
      </section>
    </div>
  );
}

function SideRow({ label, value }) {
  return (
    <div className="overviewSideRow">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function InfoBox({ title, value }) {
  return (
    <div className="overviewInfoBox">
      <span>{title}</span>
      <strong>{value}</strong>
    </div>
  );
}

function DashboardCard({ title, value, sub, onClick }) {
  return (
    <div
      className="overviewMetric dashboardCard job-standard-card"
      onClick={onClick}
      style={{
        cursor: onClick ? "pointer" : "default",
      }}
    >
      <div className="dashboardCardContent">
        <span>{title}</span>
        <strong>{value}</strong>
        {sub && <small>{sub}</small>}
      </div>

      {onClick && <div className="dashboardCardOverlay">Open {title} →</div>}
    </div>
  );
}

export default JobOverview;

