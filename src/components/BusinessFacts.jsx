import { useEffect, useMemo, useState } from "react";

const API_BASE = "http://192.168.0.22:3001";
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

function formatTime(value) {
  if (!value) return "—";
  return new Date(value).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getDate(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function getLinkDate(link) {
  if (!link) return null;
  return (
    link.date ||
    link.startTime ||
    link.start ||
    link.createdAt ||
    link.endTime ||
    null
  );
}

function getMiles(link) {
  if (!link) return 0;
  return Number(
    link.distanceMiles || link.miles || link.totalMiles || link.mileage || 0,
  );
}

function getFileLinkedCost(files, jobId) {
  return files.reduce((sum, file) => {
    const links = Array.isArray(file.links) ? file.links : [];

    const jobLinks = links.filter(
      (link) =>
        link.targetType === "job" && String(link.targetId) === String(jobId),
    );

    return (
      sum +
      jobLinks.reduce((linkSum, link) => {
        return linkSum + Number(link.cost || 0);
      }, 0)
    );
  }, 0);
}

function getBestJobDate(job, images, tripLinks) {
  const imageDate = images[0]?.localDateTime;
  const tripDate = tripLinks[0] ? getLinkDate(tripLinks[0]) : null;

  return (
    job.completedDate ||
    job.endDate ||
    job.lastVisit ||
    imageDate ||
    tripDate ||
    job.startDate ||
    job.createdAt ||
    null
  );
}

export default function BusinessFacts() {
  const [jobs, setJobs] = useState([]);
  const [files, setFiles] = useState([]);
  const [tripLinks, setTripLinks] = useState([]);
  const [jobImages, setJobImages] = useState({});
  const [selectedJobId, setSelectedJobId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [view, setView] = useState("timeline");

  useEffect(() => {
    loadEverything();
  }, []);

  async function loadEverything() {
    setLoading(true);

    try {
      const [jobsRes, filesRes, tripLinksRes] = await Promise.all([
        fetch(`${API_BASE}/jobs`),
        fetch(`${API_BASE}/api/files`),
        fetch(`${API_BASE}/api/traccar/trip-links`),
      ]);

      const jobsData = await jobsRes.json();
      const filesData = await filesRes.json();
      const tripLinksData = await tripLinksRes.json();

      const cleanJobs = Array.isArray(jobsData) ? jobsData : [];
      const cleanFiles = Array.isArray(filesData) ? filesData : [];
      const cleanTripLinks = Array.isArray(tripLinksData) ? tripLinksData : [];

      setJobs(cleanJobs);
      setFiles(cleanFiles);
      setTripLinks(cleanTripLinks);

      const imageResults = await Promise.all(
        cleanJobs.map(async (job) => {
          try {
            const res = await fetch(`${API_BASE}/api/immich/job/${job.id}`);
            const data = await res.json();
            return [job.id, Array.isArray(data.links) ? data.links : []];
          } catch {
            return [job.id, []];
          }
        }),
      );

      const imageMap = Object.fromEntries(imageResults);
      setJobImages(imageMap);

      const firstWithImages = cleanJobs.find(
        (job) => imageMap[job.id]?.length > 0,
      );
      setSelectedJobId(firstWithImages?.id || cleanJobs[0]?.id || null);
    } catch (err) {
      console.error("Failed to load JNR Mission Control:", err);
    } finally {
      setLoading(false);
    }
  }

  async function runImmichScan() {
    setScanning(true);

    try {
      await fetch(`${API_BASE}/api/immich/scan`);
      await loadEverything();
    } catch (err) {
      console.error("Immich scan failed:", err);
    } finally {
      setScanning(false);
    }
  }

  const dashboard = useMemo(() => {
    const enrichedJobs = jobs.map((job) => {
      const images = jobImages[job.id] || [];
      const jobTripLinks = tripLinks.filter(
        (link) => String(link?.jobId) === String(job.id),
      );

      const sortedImages = [...images].sort(
        (a, b) =>
          new Date(a.localDateTime || 0) - new Date(b.localDateTime || 0),
      );

      const sortedTrips = [...jobTripLinks].sort(
        (a, b) => new Date(getLinkDate(a) || 0) - new Date(getLinkDate(b) || 0),
      );

      const trackedDays = new Set(
        jobTripLinks
          .map((link) => {
            const date = getDate(getLinkDate(link));
            return date ? date.toISOString().slice(0, 10) : null;
          })
          .filter(Boolean),
      ).size;

      const miles = jobTripLinks.reduce((sum, link) => sum + getMiles(link), 0);
      const travelCost = miles * TRAVEL_COST_PER_MILE;
      const costs = getFileLinkedCost(files, job.id);
      const revenue = Number(job.quoteTotal || 0);
      const margin = revenue - costs - travelCost;

      return {
        ...job,
        images: sortedImages,
        heroImage: sortedImages[0],
        trips: sortedTrips,
        trackedDays,
        miles,
        travelCost,
        costs,
        revenue,
        margin,
        bestDate: getBestJobDate(job, sortedImages, sortedTrips),
      };
    });

    const completedJobs = enrichedJobs.filter(
      (job) => String(job.status || "").toLowerCase() === "completed",
    );

    const activeJobs = enrichedJobs.filter(
      (job) =>
        !job.archived && String(job.status || "").toLowerCase() !== "completed",
    );

    const jobsWithPhotos = enrichedJobs.filter((job) => job.images.length > 0);

    const totalPhotos = enrichedJobs.reduce(
      (sum, job) => sum + job.images.length,
      0,
    );
    const totalRevenue = completedJobs.reduce(
      (sum, job) => sum + job.revenue,
      0,
    );
    const totalCosts = completedJobs.reduce((sum, job) => sum + job.costs, 0);
    const totalTravel = completedJobs.reduce(
      (sum, job) => sum + job.travelCost,
      0,
    );
    const totalMargin = completedJobs.reduce((sum, job) => sum + job.margin, 0);
    const totalTrackedDays = completedJobs.reduce(
      (sum, job) => sum + job.trackedDays,
      0,
    );

    const marginPerTrackedDay =
      totalTrackedDays > 0 ? totalMargin / totalTrackedDays : 0;

    const timeline = jobsWithPhotos.sort(
      (a, b) => new Date(b.bestDate || 0) - new Date(a.bestDate || 0),
    );

    const needsAttention = enrichedJobs.filter((job) => {
      if (job.archived) return false;
      if (!job.location?.lat && !job.location?.lng) return true;
      if (job.images.length === 0) return true;
      if (
        String(job.status || "").toLowerCase() === "completed" &&
        job.revenue === 0
      )
        return true;
      return false;
    });

    const bestJobs = [...completedJobs]
      .sort((a, b) => b.margin - a.margin)
      .slice(0, 5);

    return {
      jobs: enrichedJobs,
      timeline,
      completedJobs,
      activeJobs,
      needsAttention,
      bestJobs,
      totalPhotos,
      jobsWithPhotos: jobsWithPhotos.length,
      totalRevenue,
      totalCosts,
      totalTravel,
      totalMargin,
      totalTrackedDays,
      marginPerTrackedDay,
      weeklyEquivalent: marginPerTrackedDay * 5,
    };
  }, [jobs, files, tripLinks, jobImages]);

  const selectedJob = dashboard.jobs.find(
    (job) => String(job.id) === String(selectedJobId),
  );

  if (loading) {
    return (
      <div className="jnrMissionPage">
        <style>{styles}</style>
        <div className="loadingCore job-standard-card">
          <h1>Loading JNR Mission Control</h1>
          <p>
            Pulling jobs, Immich memories, mileage, costs and business facts...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="jnrMissionPage">
      <style>{styles}</style>

      <section className="missionHero job-standard-card">
        <div>
          <p className="eyebrow">JNR MISSION CONTROL</p>
          <h1>Your Business, In One Place</h1>
          <p>
            Jobs, photos, memories, costs, travel, margin and proof — stitched
            together into one live command centre.
          </p>
        </div>

        <button className="scanButton" onClick={runImmichScan}>
          {scanning ? "Scanning Immich..." : "Run Immich Scan"}
        </button>
      </section>

      <section className="heroGrid">
        <BigStat
          label="Completed Margin"
          value={money(dashboard.totalMargin)}
        />
        <BigStat
          label="£ / Tracked Day"
          value={money(dashboard.marginPerTrackedDay)}
        />
        <BigStat
          label="5-Day Equivalent"
          value={money(dashboard.weeklyEquivalent)}
        />
        <BigStat label="Linked Memories" value={dashboard.totalPhotos} />
      </section>

      <section className="miniGrid">
        <MiniStat
          label="Completed Revenue"
          value={money(dashboard.totalRevenue)}
        />
        <MiniStat label="Logged Costs" value={money(dashboard.totalCosts)} />
        <MiniStat label="Travel Cost" value={money(dashboard.totalTravel)} />
        <MiniStat label="Tracked Days" value={dashboard.totalTrackedDays} />
        <MiniStat label="Active Jobs" value={dashboard.activeJobs.length} />
        <MiniStat label="Jobs With Photos" value={dashboard.jobsWithPhotos} />
        <MiniStat
          label="Needs Attention"
          value={dashboard.needsAttention.length}
        />
      </section>

      <section className="viewTabs job-standard-card">
        {["timeline", "selected", "money", "attention"].map((tab) => (
          <button
            key={tab}
            className={view === tab ? "active" : ""}
            onClick={() => setView(tab)}
          >
            {tab === "timeline" && "Memory Lane"}
            {tab === "selected" && "Selected Job"}
            {tab === "money" && "Money Makers"}
            {tab === "attention" && "Needs Attention"}
          </button>
        ))}
      </section>

      {view === "timeline" && (
        <section className="timelineLayout">
          <main className="timelineRail">
            {dashboard.timeline.map((job, index) => (
              <article
                className="memoryCard job-standard-card"
                key={job.id}
                style={{ "--delay": `${index * 65}ms` }}
                onClick={() => {
                  setSelectedJobId(job.id);
                  setView("selected");
                }}
              >
                <div className="timelineDot" />

                <div className="memoryImage">
                  <img
                    src={`${API_BASE}/api/immich/thumbnail/${job.heroImage.assetId}`}
                    alt={job.name}
                  />

                  <div className="photoStack">
                    {job.images.slice(1, 5).map((image, stackIndex) => (
                      <img
                        key={image.assetId}
                        src={`${API_BASE}/api/immich/thumbnail/${image.assetId}`}
                        alt=""
                        style={{ "--stack": stackIndex }}
                      />
                    ))}
                  </div>
                </div>

                <div className="memoryText">
                  <span>{formatDate(job.bestDate)}</span>
                  <h2>{job.name}</h2>
                  <p>{job.address || "No address"}</p>

                  <div className="pillRow">
                    <small>{job.images.length} photos</small>
                    <small>{job.status || "No status"}</small>
                    <small>{money(job.margin)} margin</small>
                  </div>
                </div>
              </article>
            ))}
          </main>

          <aside className="sideStory job-standard-card">
            <h2>Memory Lane</h2>
            <p>
              This is the visual history of JNR — every job that has linked
              Immich photos becomes a timeline moment.
            </p>

            <div className="storyStat">
              <strong>{dashboard.timeline.length}</strong>
              <span>job memories found</span>
            </div>
          </aside>
        </section>
      )}

      {view === "selected" && (
        <section className="selectedJobView">
          {selectedJob ? (
            <>
              <div className="job-standard-card selectedHero">
                <div>
                  <p className="eyebrow">SELECTED JOB</p>
                  <h1>{selectedJob.name}</h1>
                  <p>{selectedJob.address || "No address"}</p>
                </div>

                <div className="selectedStats">
                  <MiniStat
                    label="Revenue"
                    value={money(selectedJob.revenue)}
                  />
                  <MiniStat label="Costs" value={money(selectedJob.costs)} />
                  <MiniStat label="Margin" value={money(selectedJob.margin)} />
                  <MiniStat label="Photos" value={selectedJob.images.length} />
                </div>
              </div>

              <div className="galleryGrid">
                {selectedJob.images.map((image) => (
                  <a
                    className="galleryTile"
                    key={image.assetId}
                    href={`${API_BASE}/api/immich/thumbnail/${image.assetId}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <img
                      src={`${API_BASE}/api/immich/thumbnail/${image.assetId}`}
                      alt={image.originalFileName || "Job photo"}
                    />
                    <div>
                      <strong>
                        {image.originalFileName || "Immich photo"}
                      </strong>
                      <span>
                        {formatDate(image.localDateTime)} ·{" "}
                        {formatTime(image.localDateTime)}
                      </span>
                    </div>
                  </a>
                ))}
              </div>
            </>
          ) : (
            <div className="job-standard-card emptyBox">
              <h2>No job selected</h2>
            </div>
          )}
        </section>
      )}

      {view === "money" && (
        <section className="job-standard-card moneyPanel">
          <h2>Best Money Makers</h2>

          <div className="moneyList">
            {dashboard.bestJobs.map((job, index) => (
              <button
                key={job.id}
                className="moneyRow"
                onClick={() => {
                  setSelectedJobId(job.id);
                  setView("selected");
                }}
              >
                <strong>#{index + 1}</strong>
                <div>
                  <span>{job.name}</span>
                  <small>{job.address || "No address"}</small>
                </div>
                <b>{money(job.margin)}</b>
              </button>
            ))}
          </div>
        </section>
      )}

      {view === "attention" && (
        <section className="job-standard-card attentionPanel">
          <h2>Needs Attention</h2>
          <p>
            Jobs that are missing photos, geofences, or useful business data.
          </p>

          <div className="attentionList">
            {dashboard.needsAttention.map((job) => (
              <button
                key={job.id}
                className="attentionRow"
                onClick={() => {
                  setSelectedJobId(job.id);
                  setView("selected");
                }}
              >
                <strong>{job.name}</strong>
                <span>
                  {!job.location?.lat && !job.location?.lng
                    ? "Missing geofence"
                    : job.images.length === 0
                      ? "No linked photos"
                      : "Check job data"}
                </span>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function BigStat({ label, value }) {
  return (
    <div className="job-standard-card bigStat">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function MiniStat({ label, value }) {
  return (
    <div className="job-standard-card miniStat">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

const styles = `
.jnrMissionPage {
  width: 100%;
  max-width: 1480px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  text-align: left;
}

.missionHero {
  position: relative;
  overflow: hidden;
  padding: 24px;
  display: flex;
  justify-content: space-between;
  gap: 20px;
  align-items: center;
}

.missionHero::before {
  content: "";
  position: absolute;
  inset: -80px;
  background:
    radial-gradient(circle at 20% 20%, rgba(90,130,255,.28), transparent 30%),
    radial-gradient(circle at 80% 10%, rgba(117,230,160,.16), transparent 30%),
    radial-gradient(circle at 60% 100%, rgba(255,190,80,.12), transparent 35%);
}

.missionHero > * {
  position: relative;
  z-index: 1;
}

.eyebrow {
  color: #9db8ff;
  font-size: .78rem;
  font-weight: 900;
  letter-spacing: .14em;
  margin-bottom: 6px;
}

.missionHero h1 {
  color: #fff;
  font-size: clamp(2.2rem, 5vw, 5rem);
  margin: 0 0 8px;
}

.missionHero p {
  color: var(--text-soft);
  max-width: 720px;
  line-height: 1.5;
}

.scanButton {
  border: none;
  border-radius: 999px;
  padding: 14px 18px;
  font-weight: 900;
  cursor: pointer;
  background: linear-gradient(135deg, #75e6a0, #5a82ff);
  color: #06100b;
}

.heroGrid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 14px;
}

.bigStat {
  padding: 18px;
  min-height: 110px;
}

.bigStat span,
.miniStat span {
  display: block;
  color: var(--text-soft);
  font-size: .78rem;
  margin-bottom: 8px;
}

.bigStat strong {
  color: #fff;
  font-size: 1.8rem;
}

.miniGrid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 12px;
}

.miniStat {
  padding: 13px;
}

.miniStat strong {
  color: #75e6a0;
  font-size: 1.05rem;
}

.viewTabs {
  padding: 10px;
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.viewTabs button {
  border: none;
  border-radius: 999px;
  padding: 10px 14px;
  background: rgba(255,255,255,.05);
  color: var(--text-soft);
  font-weight: 900;
  cursor: pointer;
}

.viewTabs button.active {
  color: #75e6a0;
  background: rgba(117,230,160,.12);
  border: 1px solid rgba(117,230,160,.35);
}

.timelineLayout {
  display: grid;
  grid-template-columns: 1fr 360px;
  gap: 16px;
  align-items: start;
}

.timelineRail {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding-left: 28px;
}

.timelineRail::before {
  content: "";
  position: absolute;
  left: 10px;
  top: 10px;
  bottom: 10px;
  width: 2px;
  background: linear-gradient(to bottom, #5a82ff, #75e6a0, rgba(255,255,255,.08));
}

.memoryCard {
  position: relative;
  padding: 14px;
  display: grid;
  grid-template-columns: 280px 1fr;
  gap: 18px;
  align-items: center;
  cursor: pointer;
  opacity: 0;
  transform: translateY(20px);
  animation: riseIn .5s ease forwards;
  animation-delay: var(--delay);
}

.memoryCard:hover {
  border-color: rgba(117,230,160,.35);
  background: rgba(117,230,160,.06);
}

.timelineDot {
  position: absolute;
  left: -26px;
  width: 18px;
  height: 18px;
  border-radius: 999px;
  background: #75e6a0;
  border: 3px solid #080b10;
  box-shadow: 0 0 0 5px rgba(117,230,160,.12);
}

.memoryImage {
  height: 190px;
  border-radius: var(--radius-md);
  overflow: hidden;
  position: relative;
}

.memoryImage > img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.photoStack {
  position: absolute;
  right: 12px;
  bottom: 12px;
}

.photoStack img {
  position: absolute;
  right: calc(var(--stack) * 20px);
  bottom: calc(var(--stack) * 5px);
  width: 58px;
  height: 58px;
  object-fit: cover;
  border-radius: 12px;
  border: 2px solid rgba(255,255,255,.25);
  box-shadow: 0 10px 22px rgba(0,0,0,.35);
}

.memoryText span {
  color: #75e6a0;
  font-weight: 900;
}

.memoryText h2 {
  color: #fff;
  margin: 6px 0;
}

.memoryText p {
  color: var(--text-soft);
}

.pillRow {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 12px;
}

.pillRow small {
  border-radius: 999px;
  padding: 6px 10px;
  background: rgba(90,130,255,.12);
  color: #9db8ff;
  font-weight: 900;
}

.sideStory,
.moneyPanel,
.attentionPanel,
.selectedHero {
  padding: 18px;
}

.sideStory h2,
.moneyPanel h2,
.attentionPanel h2,
.selectedHero h1 {
  color: #fff;
}

.sideStory p,
.attentionPanel p,
.selectedHero p {
  color: var(--text-soft);
}

.storyStat {
  margin-top: 18px;
  padding: 18px;
  border-radius: var(--radius-md);
  background: rgba(255,255,255,.04);
  border: var(--border-soft);
  text-align: center;
}

.storyStat strong {
  display: block;
  color: #fff;
  font-size: 2.4rem;
}

.storyStat span {
  color: var(--text-soft);
}

.selectedStats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
}

.galleryGrid {
  margin-top: 16px;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 14px;
}

.galleryTile {
  overflow: hidden;
  border-radius: var(--radius-md);
  background: rgba(255,255,255,.035);
  border: var(--border-soft);
  color: inherit;
  text-decoration: none;
}

.galleryTile img {
  width: 100%;
  aspect-ratio: 1 / 1;
  object-fit: cover;
  display: block;
}

.galleryTile div {
  padding: 10px;
}

.galleryTile strong {
  color: #fff;
  display: block;
  font-size: .85rem;
}

.galleryTile span {
  color: var(--text-soft);
  font-size: .75rem;
}

.moneyList,
.attentionList {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.moneyRow,
.attentionRow {
  border: var(--border-soft);
  background: rgba(255,255,255,.035);
  border-radius: var(--radius-md);
  padding: 12px;
  color: #fff;
  display: grid;
  grid-template-columns: 60px 1fr auto;
  gap: 12px;
  align-items: center;
  text-align: left;
  cursor: pointer;
}

.moneyRow b {
  color: #75e6a0;
}

.moneyRow small,
.attentionRow span {
  color: var(--text-soft);
}

.attentionRow {
  grid-template-columns: 1fr auto;
}

.loadingCore,
.emptyBox {
  min-height: 50vh;
  display: grid;
  place-items: center;
  text-align: center;
}

.loadingCore h1,
.emptyBox h2 {
  color: #fff;
}

.loadingCore p {
  color: var(--text-soft);
}

@keyframes riseIn {
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (max-width: 1200px) {
  .heroGrid {
    grid-template-columns: repeat(2, 1fr);
  }

  .miniGrid {
    grid-template-columns: repeat(3, 1fr);
  }

  .timelineLayout {
    grid-template-columns: 1fr;
  }

  .selectedStats {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 760px) {
  .missionHero {
    flex-direction: column;
    align-items: flex-start;
  }

  .heroGrid,
  .miniGrid,
  .selectedStats {
    grid-template-columns: 1fr;
  }

  .memoryCard {
    grid-template-columns: 1fr;
  }

  .memoryImage {
    height: 230px;
  }

  .moneyRow,
  .attentionRow {
    grid-template-columns: 1fr;
  }
}
`;
