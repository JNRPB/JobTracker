import { useEffect, useMemo, useRef, useState } from "react";
import "./WelcomeScreen.css";
import { getJobColour } from "./jobColour";

const API_BASE = "";
const ROTATE_EVERY_MS = 11000;
const LIVE_JOB_STATUSES = new Set([
  "accepted",
  "approved",
  "booked",
  "not started",
  "in progress",
]);

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function money(value) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(number(value));
}

function parseDate(value) {
  if (!value) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(String(value))) {
    const [year, month, day] = String(value).split("-").map(Number);
    return new Date(year, month - 1, day, 12);
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function startOfDay(value) {
  const date = value instanceof Date ? new Date(value) : parseDate(value);
  if (!date) return null;
  date.setHours(0, 0, 0, 0);
  return date;
}

function daysAgo(value, now = new Date()) {
  const date = startOfDay(value);
  const today = startOfDay(now);
  if (!date || !today) return null;
  return Math.max(0, Math.round((today - date) / 86400000));
}

function friendlyRelative(value, now = new Date()) {
  const difference = daysAgo(value, now);

  if (difference === null) return "No date recorded";
  if (difference === 0) return "today";
  if (difference === 1) return "yesterday";
  if (difference === 2) return "the day before yesterday";
  if (difference === 7) return "a week ago today";
  if (difference === 8) return "a week ago yesterday";
  if (difference < 14) return `${difference} days ago`;

  const weeks = Math.floor(difference / 7);
  const remainder = difference % 7;

  if (remainder === 0) {
    return `${weeks} week${weeks === 1 ? "" : "s"} ago`;
  }

  return `${difference} days ago`;
}

function shortRelative(value, now = new Date()) {
  const date = parseDate(value);
  if (!date) return "";

  const milliseconds = Math.max(0, now - date);
  const minutes = Math.floor(milliseconds / 60000);
  const hours = Math.floor(milliseconds / 3600000);
  const days = daysAgo(date, now);

  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24 && days === 0) return `${hours}h ago`;
  return friendlyRelative(date, now);
}

function weekday(value) {
  const date = parseDate(value);
  if (!date) return "No trip recorded";

  return date.toLocaleDateString("en-GB", {
    weekday: "long",
  });
}

function dateValue(value) {
  const date = parseDate(value);
  return date ? date.getTime() : 0;
}

function latestBy(items, getDate) {
  return [...items].sort(
    (a, b) => dateValue(getDate(b)) - dateValue(getDate(a)),
  )[0];
}

function getJobName(job) {
  return job?.name || job?.title || job?.customer || `Job ${job?.id || ""}`;
}

function getJobAddress(job) {
  return (
    job?.address ||
    job?.customerDetails?.address ||
    job?.location?.address ||
    "No address saved"
  );
}

function getFileUploadDate(file) {
  return file?.uploadedAt || file?.createdAt || file?.dateSorted || null;
}

function getFilePurchaseDate(file) {
  return file?.purchaseDate || file?.date || file?.dateSorted || null;
}

function jobLinksForFile(file, jobId) {
  return (Array.isArray(file?.links) ? file.links : []).filter(
    (link) =>
      link?.targetType === "job" &&
      String(link?.targetId) === String(jobId),
  );
}

function invoiceNumber(invoice) {
  return invoice?.invoiceNumber || invoice?.number || "Invoice";
}

function buildJobModel(job, files, tripLinks, now) {
  const jobTrips = tripLinks.filter(
    (trip) => {
      const type = String(trip?.type || "").toLowerCase();
      return (
        String(trip?.jobId) === String(job.id) &&
        (!type || type === "job" || type === "job_visit")
      );
    },
  );

  const fileRecords = files
    .map((file) => ({
      file,
      links: jobLinksForFile(file, job.id),
    }))
    .filter((record) => record.links.length);

  const purchases = fileRecords.flatMap(({ file, links }) =>
    links
      .filter((link) => number(link?.cost) > 0)
      .map((link) => ({
        file,
        link,
        amount: number(link.cost),
        date: getFilePurchaseDate(file),
      })),
  );

  const lastTrip = latestBy(jobTrips, (trip) => trip.startTime || trip.date);
  const lastPurchase = latestBy(purchases, (purchase) => purchase.date);
  const lastUpload = latestBy(fileRecords, ({ file }) => getFileUploadDate(file));

  const recentTripDays = new Set(
    jobTrips
      .filter((trip) => daysAgo(trip.startTime || trip.date, now) <= 14)
      .map((trip) => String(trip.date || trip.startTime).slice(0, 10)),
  ).size;

  const recentPurchases = purchases.filter(
    (purchase) => daysAgo(purchase.date, now) <= 14,
  ).length;

  const recentUploads = fileRecords.filter(
    ({ file }) => daysAgo(getFileUploadDate(file), now) <= 7,
  ).length;

  const tripAge = daysAgo(lastTrip?.startTime || lastTrip?.date, now);
  const purchaseAge = daysAgo(lastPurchase?.date, now);
  const uploadAge = daysAgo(
    lastUpload ? getFileUploadDate(lastUpload.file) : null,
    now,
  );

  let score = 5;

  if (tripAge !== null) {
    if (tripAge === 0) score += 40;
    else if (tripAge <= 3) score += 34;
    else if (tripAge <= 7) score += 25;
    else if (tripAge <= 14) score += 12;
  }

  score += Math.min(recentTripDays * 3, 18);

  if (purchaseAge !== null) {
    if (purchaseAge <= 2) score += 15;
    else if (purchaseAge <= 7) score += 10;
    else if (purchaseAge <= 14) score += 5;
  }

  score += Math.min(recentPurchases * 2, 10);

  if (uploadAge !== null && uploadAge <= 7) {
    score += Math.min(recentUploads * 2, 10);
  }

  const invoices = Array.isArray(job.invoices) ? job.invoices : [];
  const payments = Array.isArray(job.payments) ? job.payments : [];
  const quotes = Array.isArray(job.quotes) ? job.quotes : [];
  const financialInvoices = invoices.filter((invoice) =>
    ["issued", "emailed", "paid"].includes(
      String(invoice?.status || "").toLowerCase(),
    ),
  );
  const invoicedTotal = financialInvoices.reduce(
    (sum, invoice) => sum + number(invoice.total),
    0,
  );
  const recordedPaymentTotal = payments.reduce(
    (sum, payment) => sum + number(payment.amount || payment.total),
    0,
  );
  const invoicePaidTotal = financialInvoices.reduce(
    (sum, invoice) =>
      sum +
      (String(invoice?.status || "").toLowerCase() === "paid"
        ? number(invoice.paidAmount || invoice.total)
        : number(invoice.paidAmount)),
    0,
  );
  const paidTotal = recordedPaymentTotal || invoicePaidTotal;
  const outstanding = Math.max(invoicedTotal - paidTotal, 0);
  const acceptedValue = quotes
    .filter((quote) => String(quote?.status || "").toLowerCase() === "accepted")
    .reduce((sum, quote) => sum + number(quote.total), 0);
  const activeEstimate =
    quotes.find((quote) => String(quote.id) === String(job.activeEstimateId)) ||
    quotes.find((quote) => quote.isActive) ||
    latestBy(quotes, (quote) => quote.updatedAt || quote.createdAt);
  const contractValue =
    number(job.contractValue) ||
    acceptedValue ||
    number(job.quoteTotal) ||
    number(activeEstimate?.total);
  const contractInvoiced = financialInvoices
    .filter((invoice) => !invoice.isStandalone)
    .reduce((sum, invoice) => sum + number(invoice.total), 0);
  const remainingToInvoice = Math.max(contractValue - contractInvoiced, 0);
  const recordedCosts = purchases.reduce(
    (sum, purchase) => sum + number(purchase.amount),
    0,
  );

  const uniqueTravelDays = new Set(
    jobTrips.map((trip) => String(trip.date || trip.startTime).slice(0, 10)),
  ).size;

  const allocatedMiles = jobTrips.reduce(
    (sum, trip) =>
      sum + number(trip.distanceMiles || trip.miles || trip.totalMiles),
    0,
  );

  return {
    job,
    score: Math.min(Math.round(score), 100),
    activityLabel:
      score >= 50 ? "Highly active" : score >= 25 ? "Active" : "Quiet",
    fileRecords,
    purchases,
    lastTrip,
    uniqueTravelDays,
    allocatedMiles,
    contractValue,
    recordedCosts,
    invoicedTotal,
    paidTotal,
    outstanding,
    remainingToInvoice,
  };
}

function Icon({ name }) {
  const paths = {
    calendar: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M16 3v4M8 3v4M3 10h18" />
      </>
    ),
    cart: (
      <>
        <path d="M3 4h2l2.2 10.2a2 2 0 0 0 2 1.6h7.9a2 2 0 0 0 1.9-1.4L21 8H6" />
        <circle cx="10" cy="20" r="1" />
        <circle cx="18" cy="20" r="1" />
      </>
    ),
    van: (
      <>
        <path d="M3 7h11v10H3zM14 10h4l3 4v3h-7z" />
        <circle cx="7" cy="18" r="2" />
        <circle cx="18" cy="18" r="2" />
      </>
    ),
    folder: (
      <path d="M3 6a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    ),
    inbox: (
      <>
        <path d="m4 5 3-2h10l3 2 2 14H2z" />
        <path d="M2.5 14H8l2 3h4l2-3h5.5" />
      </>
    ),
    eye: (
      <>
        <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" />
        <circle cx="12" cy="12" r="2.5" />
      </>
    ),
    pin: (
      <>
        <path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" />
        <circle cx="12" cy="10" r="2.5" />
      </>
    ),
    file: (
      <>
        <path d="M6 2h8l4 4v16H6z" />
        <path d="M14 2v5h5M9 13h6M9 17h6" />
      </>
    ),
    todo: (
      <>
        <rect x="4" y="3" width="16" height="18" rx="2" />
        <path d="m8 9 2 2 4-4M8 16h8" />
      </>
    ),
  };

  return (
    <svg
      className="hq-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name] || paths.file}
    </svg>
  );
}

function Stat({ icon, label, value, detail }) {
  return (
    <div className="hq-hero-stat">
      <div className="hq-stat-label">
        <Icon name={icon} />
        <span>{label}</span>
      </div>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}

function NoticeCard({ tone, icon, children, button, onClick }) {
  return (
    <article className={`hq-notice hq-notice-${tone}`}>
      <div className="hq-notice-icon">
        <Icon name={icon} />
      </div>
      <div className="hq-notice-copy">
        <p>{children}</p>
        <button type="button" onClick={onClick}>
          {button}
        </button>
      </div>
    </article>
  );
}

export default function WelcomeScreen({
  jobs = [],
  files = [],
  unsortedFiles = [],
  navigate,
}) {
  const [tripLinks, setTripLinks] = useState([]);
  const [remoteFiles, setRemoteFiles] = useState(files);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const [jobPhotos, setJobPhotos] = useState({});
  const [now, setNow] = useState(new Date());
  const requestedPhotos = useRef(new Set());

  useEffect(() => {
    setRemoteFiles(Array.isArray(files) ? files : []);
  }, [files]);

  useEffect(() => {
    let cancelled = false;

    async function loadLiveData() {
      try {
        const requests = [fetch(`${API_BASE}/api/traccar/trip-links`)];

        if (!Array.isArray(files) || files.length === 0) {
          requests.push(fetch(`${API_BASE}/api/files`));
        }

        const responses = await Promise.all(requests);
        const tripResponse = responses[0];

        if (tripResponse.ok) {
          const data = await tripResponse.json();
          if (!cancelled) setTripLinks(Array.isArray(data) ? data : []);
        }

        if (responses[1]?.ok) {
          const data = await responses[1].json();
          if (!cancelled) setRemoteFiles(Array.isArray(data) ? data : []);
        }
      } catch (error) {
        console.error("Could not load HQ homepage activity:", error);
      }
    }

    loadLiveData();
    const refreshTimer = window.setInterval(loadLiveData, 60000);

    return () => {
      cancelled = true;
      window.clearInterval(refreshTimer);
    };
  }, [files]);

  useEffect(() => {
    const clockTimer = window.setInterval(() => setNow(new Date()), 60000);
    return () => window.clearInterval(clockTimer);
  }, []);

  const liveJobs = useMemo(
    () =>
      jobs.filter(
        (job) =>
          !job?.archived &&
          LIVE_JOB_STATUSES.has(
            String(job?.status || "")
              .trim()
              .toLowerCase(),
          ),
      ),
    [jobs],
  );

  const rankedJobs = useMemo(
    () =>
      liveJobs
        .map((job) => buildJobModel(job, remoteFiles, tripLinks, now))
        .sort((a, b) => b.score - a.score),
    [liveJobs, remoteFiles, tripLinks, now],
  );

  useEffect(() => {
    setActiveIndex((current) =>
      rankedJobs.length ? Math.min(current, rankedJobs.length - 1) : 0,
    );
  }, [rankedJobs.length]);

  const rotationPaused = isPaused || isHovering;

  useEffect(() => {
    if (rotationPaused || rankedJobs.length <= 1) return undefined;

    const rotateTimer = window.setTimeout(() => {
      setActiveIndex((current) => (current + 1) % rankedJobs.length);
    }, ROTATE_EVERY_MS);

    return () => window.clearTimeout(rotateTimer);
  }, [activeIndex, rotationPaused, rankedJobs.length]);

  const activeModel = rankedJobs[activeIndex] || null;
  const activeJob = activeModel?.job || null;

  useEffect(() => {
    const jobId = activeJob?.id;

    if (!jobId || requestedPhotos.current.has(String(jobId))) return;
    requestedPhotos.current.add(String(jobId));

    let cancelled = false;

    fetch(`${API_BASE}/api/immich/job/${encodeURIComponent(jobId)}`)
      .then((response) => {
        if (!response.ok) throw new Error("No Immich photos available");
        return response.json();
      })
      .then((data) => {
        const links = Array.isArray(data?.links) ? data.links : [];
        const latest = latestBy(
          links.filter((link) => link?.assetId),
          (link) => link.fileCreatedAt || link.localDateTime || link.linkedAt,
        );

        if (!cancelled) {
          setJobPhotos((current) => ({
            ...current,
            [jobId]: latest?.assetId
              ? `${API_BASE}/api/immich/thumbnail/${encodeURIComponent(
                  latest.assetId,
                )}`
              : null,
          }));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setJobPhotos((current) => ({ ...current, [jobId]: null }));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeJob?.id]);

  const latestAllocatedTrip = useMemo(
    () => latestBy(tripLinks, (trip) => trip.startTime || trip.date),
    [tripLinks],
  );

  const latestUploadedFile = useMemo(
    () => latestBy(remoteFiles, getFileUploadDate),
    [remoteFiles],
  );

  const openTodos = useMemo(
    () =>
      jobs
        .filter((job) => !job?.archived)
        .flatMap((job) =>
          (Array.isArray(job.todos) ? job.todos : [])
            .filter((todo) => !todo?.completed)
            .map((todo) => ({ ...todo, jobId: job.id })),
        ),
    [jobs],
  );

  const highTodoCount = openTodos.filter(
    (todo) => todo.highImportance,
  ).length;

  const jobsWithOpenTodos = new Set(openTodos.map((todo) => String(todo.jobId)))
    .size;

  const recentActivity = useMemo(() => {
    const jobMap = new Map(jobs.map((job) => [String(job.id), job]));

    const tripEvents = tripLinks.map((trip) => {
      const job = jobMap.get(String(trip.jobId));
      return {
        id: `trip-${trip.date}-${trip.tripId}`,
        type: "trip",
        icon: "pin",
        label: `${trip.jobName || getJobName(job)} visited`,
        at: trip.startTime || trip.date,
        jobId: job?.id,
        jobColour: job ? getJobColour(job) : null,
      };
    });

    const fileEvents = remoteFiles.map((file) => {
      const jobLink = (Array.isArray(file.links) ? file.links : []).find(
        (link) => link?.targetType === "job" && jobMap.has(String(link.targetId)),
      );
      const job = jobLink ? jobMap.get(String(jobLink.targetId)) : null;
      return {
        id: `file-${file.id || file.fileName}`,
        type: "file",
        icon: "file",
        label: `${file.supplier || file.fileName || "File"} sorted`,
        at: getFileUploadDate(file),
        jobId: job?.id,
        jobColour: job ? getJobColour(job) : null,
      };
    });

    const invoiceEvents = jobs.flatMap((job) =>
      (Array.isArray(job.invoices) ? job.invoices : []).flatMap((invoice) => {
        const events = [];

        if (invoice.lastViewedAt) {
          events.push({
            id: `view-${job.id}-${invoiceNumber(invoice)}-${invoice.lastViewedAt}`,
            type: "view",
            icon: "eye",
            label: `${invoiceNumber(invoice)} viewed`,
            at: invoice.lastViewedAt,
            jobId: job.id,
            jobColour: getJobColour(job),
          });
        }

        if (invoice.emailedAt || invoice.sentAt) {
          events.push({
            id: `email-${job.id}-${invoiceNumber(invoice)}`,
            type: "email",
            icon: "file",
            label: `${invoiceNumber(invoice)} emailed`,
            at: invoice.emailedAt || invoice.sentAt,
            jobId: job.id,
            jobColour: getJobColour(job),
          });
        }

        return events;
      }),
    );

    return [...tripEvents, ...fileEvents, ...invoiceEvents]
      .filter((event) => parseDate(event.at))
      .sort((a, b) => dateValue(b.at) - dateValue(a.at))
      .slice(0, 5);
  }, [jobs, remoteFiles, tripLinks]);

  const tripGap = daysAgo(
    latestAllocatedTrip?.startTime || latestAllocatedTrip?.date,
    now,
  );
  const uploadGap = daysAgo(getFileUploadDate(latestUploadedFile), now);
  const selectedCoverUrl = activeJob?.coverImageAssetId
    ? `${API_BASE}/api/immich/thumbnail/${encodeURIComponent(
        activeJob.coverImageAssetId,
      )}`
    : null;
  const photoUrl = selectedCoverUrl || (activeJob ? jobPhotos[activeJob.id] : null);
  const activeJobTodos = (Array.isArray(activeJob?.todos) ? activeJob.todos : [])
    .filter((todo) => !todo?.completed);
  const activeJobHighTodos = activeJobTodos.filter(
    (todo) => todo.highImportance,
  ).length;

  const greeting =
    now.getHours() < 12
      ? "Good morning"
      : now.getHours() < 18
        ? "Good afternoon"
        : "Good evening";

  function openJob(jobId) {
    navigate?.("JobCard", { jobId });
  }

  function showPreviousJob() {
    setActiveIndex((current) =>
      rankedJobs.length
        ? (current - 1 + rankedJobs.length) % rankedJobs.length
        : 0,
    );
  }

  function showNextJob() {
    setActiveIndex((current) =>
      rankedJobs.length ? (current + 1) % rankedJobs.length : 0,
    );
  }

  if (!activeModel) {
    return (
      <main className="hq-home">
        <section className="hq-empty-hero">
          <div>
            <span className="hq-kicker">{greeting}, Josh</span>
            <h1>JNR HQ is ready.</h1>
            <p>No accepted, booked or in-progress jobs are currently live.</p>
            <button
              type="button"
              className="hq-primary-button"
              onClick={() => navigate?.("JobStatusOverview")}
            >
              View jobs
            </button>
          </div>
        </section>
      </main>
    );
  }

  const { lastTrip } = activeModel;
  const lastTripDate = lastTrip?.startTime || lastTrip?.date;
  const jobColour = getJobColour(activeJob);

  return (
    <main className="hq-home">
      <section
        className="hq-active-hero"
        style={{ "--job-colour": jobColour }}
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
        aria-label="Live job slideshow"
      >
        <div
          className={`hq-hero-background ${photoUrl ? "has-photo" : ""}`}
          aria-hidden="true"
        >
          {photoUrl && (
            <div
              key={`${activeJob.id}-${photoUrl}`}
              className="hq-job-photo"
              style={{ backgroundImage: `url("${photoUrl}")` }}
            />
          )}
          <div className="hq-hero-shade" />
        </div>

        <div className="hq-hero-main">
          <div className="hq-hero-copy">
            <span className="hq-kicker">{greeting}, Josh</span>
            <h1>{getJobName(activeJob)}</h1>
            <p className="hq-job-address">{getJobAddress(activeJob)}</p>

            <div className="hq-job-pills">
              <span className="hq-status-pill">{activeJob.status || "Live"}</span>
              <span className="hq-activity-pill">
                <i />
                {activeModel.activityLabel}
              </span>
              {activeJobTodos.length > 0 && (
                <button
                  type="button"
                  className={`hq-todo-pill ${activeJobHighTodos ? "has-high" : ""}`}
                  onClick={() => navigate?.("TodoPage", { jobId: activeJob.id })}
                >
                  <span>✓</span>
                  {activeJobTodos.length} TODO{activeJobTodos.length === 1 ? "" : "s"}
                  {activeJobHighTodos > 0 && <i>★ {activeJobHighTodos}</i>}
                </button>
              )}
            </div>

            <button
              type="button"
              className="hq-open-job"
              onClick={() => openJob(activeJob.id)}
            >
              Open job <span>→</span>
            </button>
          </div>

          <div className="hq-hero-data">
            <div className="hq-stat-grid">
              <Stat
                icon="calendar"
                label="Last site visit"
                value={weekday(lastTripDate)}
                detail={friendlyRelative(lastTripDate, now)}
              />
              <Stat
                icon="van"
                label="Site record"
                value={`${activeModel.uniqueTravelDays} ${
                  activeModel.uniqueTravelDays === 1 ? "day" : "days"
                }`}
                detail={`${activeModel.allocatedMiles.toFixed(1)} allocated miles`}
              />
              <Stat
                icon="folder"
                label="Contract"
                value={activeModel.contractValue ? money(activeModel.contractValue) : "Not set"}
                detail={`${money(activeModel.recordedCosts)} recorded costs`}
              />
              <Stat
                icon="cart"
                label="Cash received"
                value={money(activeModel.paidTotal)}
                detail={
                  activeModel.outstanding > 0
                    ? `${money(activeModel.outstanding)} invoiced and outstanding`
                    : activeModel.invoicedTotal > 0
                      ? "All issued invoices paid"
                      : "No issued invoices yet"
                }
              />
            </div>

            <div className="hq-contract-position">
              <div className="hq-contract-heading">
                <span>Contract position</span>
                <strong>
                  {activeModel.contractValue
                    ? `${Math.min(
                        Math.round((activeModel.paidTotal / activeModel.contractValue) * 100),
                        100,
                      )}% collected`
                    : "Waiting for accepted estimate"}
                </strong>
              </div>
              <div className="hq-contract-track" aria-hidden="true">
                <span
                  className="invoiced"
                  style={{
                    width: `${activeModel.contractValue
                      ? Math.min((activeModel.invoicedTotal / activeModel.contractValue) * 100, 100)
                      : 0}%`,
                  }}
                />
                <span
                  className="paid"
                  style={{
                    width: `${activeModel.contractValue
                      ? Math.min((activeModel.paidTotal / activeModel.contractValue) * 100, 100)
                      : 0}%`,
                  }}
                />
              </div>
              <div className="hq-contract-legend">
                <span><i className="paid" />Paid <strong>{money(activeModel.paidTotal)}</strong></span>
                <span><i className="invoiced" />Invoiced <strong>{money(activeModel.invoicedTotal)}</strong></span>
                <span><i className="unbilled" />Not invoiced <strong>{money(activeModel.remainingToInvoice)}</strong></span>
              </div>
            </div>
          </div>
        </div>

        <div className="hq-carousel-controls">
          <div className="hq-carousel-progress">
            <span key={`${activeJob.id}-${rotationPaused}`} className={rotationPaused ? "paused" : ""} />
          </div>

          <div className="hq-carousel-dots" aria-label="Choose active job">
            {rankedJobs.map((model, index) => (
              <button
                type="button"
                key={model.job.id}
                className={index === activeIndex ? "active" : ""}
                style={{
                  "--dot-colour": getJobColour(model.job),
                }}
                onClick={() => setActiveIndex(index)}
                aria-label={`Show ${getJobName(model.job)}`}
              />
            ))}
          </div>

          <div className="hq-carousel-actions">
            <span>{String(activeIndex + 1).padStart(2, "0")} / {String(rankedJobs.length).padStart(2, "0")}</span>
            <button type="button" onClick={showPreviousJob} aria-label="Previous live job">←</button>
            <button type="button" onClick={() => setIsPaused((current) => !current)} aria-label={isPaused ? "Resume slideshow" : "Pause slideshow"}>{isPaused ? "▶" : "Ⅱ"}</button>
            <button type="button" onClick={showNextJob} aria-label="Next live job">→</button>
          </div>
        </div>
      </section>

      <section className="hq-noticed-section">
        <div className="hq-section-heading">
          <div>
            <span className="hq-kicker">Your admin co-pilot</span>
            <h2>HQ noticed…</h2>
          </div>
          <span>{rankedJobs.length} live job{rankedJobs.length === 1 ? "" : "s"}</span>
        </div>

        <div className="hq-notice-grid">
          <NoticeCard
            tone="blue"
            icon="van"
            button="Review journeys"
            onClick={() => navigate?.("JobHeatMap")}
          >
            {tripGap === null
              ? "No journeys have been allocated yet."
              : tripGap === 0
                ? "Journeys have been allocated today."
                : `It’s been ${tripGap} day${
                    tripGap === 1 ? "" : "s"
                  } since a journey was allocated.`}
          </NoticeCard>

          <NoticeCard
            tone="amber"
            icon="inbox"
            button={unsortedFiles.length ? "Sort inbox" : "Upload files"}
            onClick={() => navigate?.("UnsortedFiles")}
          >
            {unsortedFiles.length
              ? `${unsortedFiles.length} unsorted file${
                  unsortedFiles.length === 1 ? " is" : "s are"
                } waiting.`
              : uploadGap === null
                ? "No files have been uploaded yet."
                : uploadGap === 0
                  ? "Files have been uploaded today."
                  : `No files have been uploaded for ${uploadGap} day${
                      uploadGap === 1 ? "" : "s"
                    }.`}
          </NoticeCard>

          <NoticeCard
            tone={highTodoCount ? "red" : "green"}
            icon="todo"
            button="Open TODOs"
            onClick={() => navigate?.("TodoPage")}
          >
            {openTodos.length === 0
              ? "No outstanding TODOs. Every job is clear."
              : highTodoCount > 0
                ? `${openTodos.length} outstanding TODO${
                    openTodos.length === 1 ? "" : "s"
                  }, including ${highTodoCount} high importance.`
                : `${openTodos.length} outstanding TODO${
                    openTodos.length === 1 ? "" : "s"
                  } across ${jobsWithOpenTodos} job${
                    jobsWithOpenTodos === 1 ? "" : "s"
                  }.`}
          </NoticeCard>
        </div>
      </section>

      <section className="hq-today-section">
        <div className="hq-section-heading hq-today-heading">
          <div>
            <span className="hq-kicker">Live business trail</span>
            <h2>Today at JNR</h2>
          </div>

          <div className="hq-quick-actions">
            <button
              type="button"
              className="primary"
              onClick={() => navigate?.("CreateJob")}
            >
              <span>＋</span> New job
            </button>
            <button
              type="button"
              onClick={() => navigate?.("JobStatusOverview")}
            >
              <span>＋</span> New estimate
            </button>
            <button type="button" onClick={() => navigate?.("UnsortedFiles")}>
              <span>⇧</span> Upload
            </button>
          </div>
        </div>

        <div className="hq-activity-rail">
          {recentActivity.length ? (
            recentActivity.map((event) => (
              <button
                type="button"
                className={`hq-activity-item hq-activity-${event.type} ${event.jobColour ? "has-job" : ""}`}
                style={event.jobColour ? { "--job-colour": event.jobColour } : undefined}
                key={event.id}
                onClick={() =>
                  event.type === "trip"
                    ? navigate?.("JobHeatMap")
                    : navigate?.("Files")
                }
              >
                <span className="hq-activity-icon">
                  <Icon name={event.icon} />
                </span>
                <strong>{event.label}</strong>
                <small>{shortRelative(event.at, now)}</small>
              </button>
            ))
          ) : (
            <p className="hq-no-activity">Activity will appear here as HQ records it.</p>
          )}
        </div>
      </section>
    </main>
  );
}
