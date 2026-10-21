import { useEffect, useMemo, useState } from "react";
import "./ForecastPage.css";

const API_BASE = "";
const DAY_MS = 24 * 60 * 60 * 1000;
const ACTIVITY_GAP_DAYS = 21;

const FALLBACK_COLOURS = [
  "#6f8cff",
  "#3ecf8e",
  "#f4b942",
  "#ff6b72",
  "#a779e9",
  "#37b9d6",
  "#e47ca6",
  "#8bbf5a",
];

function clamp(value, minimum, maximum) {
  return Math.min(Math.max(value, minimum), maximum);
}

function parseDate(value) {
  if (!value) return null;

  const dateOnly = String(value).slice(0, 10);
  const match = dateOnly.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (match) {
    const date = new Date(
      Number(match[1]),
      Number(match[2]) - 1,
      Number(match[3]),
      12,
    );

    return Number.isNaN(date.getTime()) ? null : date;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;

  return new Date(
    parsed.getFullYear(),
    parsed.getMonth(),
    parsed.getDate(),
    12,
  );
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12);
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1, 12);
}

function endOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 12);
}

function addDays(date, amount) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function differenceInDays(start, end) {
  return Math.round((startOfDay(end) - startOfDay(start)) / DAY_MS);
}

function formatDate(date) {
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatMonth(date, includeYear = true) {
  return date.toLocaleDateString("en-GB", {
    month: "short",
    ...(includeYear ? { year: "numeric" } : {}),
  });
}

function money(value) {
  return `£${Number(value || 0).toLocaleString("en-GB", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function hashString(value) {
  return String(value || "")
    .split("")
    .reduce((hash, character) => {
      return (hash * 31 + character.charCodeAt(0)) >>> 0;
    }, 0);
}

function fallbackColour(jobId) {
  return FALLBACK_COLOURS[hashString(jobId) % FALLBACK_COLOURS.length];
}

function getJobColour(job, jobId) {
  const suppliedColour = job?.colour || job?.color || job?.themeColor;

  if (/^#[0-9a-f]{6}$/i.test(String(suppliedColour || ""))) {
    return suppliedColour;
  }

  return fallbackColour(jobId);
}

function hexToRgba(hex, alpha) {
  const clean = String(hex || "").replace("#", "");
  const red = Number.parseInt(clean.slice(0, 2), 16);
  const green = Number.parseInt(clean.slice(2, 4), 16);
  const blue = Number.parseInt(clean.slice(4, 6), 16);

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function getJobName(job, jobId, fallbackName) {
  return (
    job?.title ||
    job?.name ||
    job?.projectName ||
    job?.address ||
    fallbackName ||
    `Job ${jobId}`
  );
}

function buildActivityPeriods(events) {
  if (!events.length) return [];

  const sortedEvents = [...events].sort((a, b) => a.date - b.date);
  const clusters = [];

  sortedEvents.forEach((event) => {
    const currentCluster = clusters.at(-1);

    if (!currentCluster) {
      clusters.push([event]);
      return;
    }

    const previousEvent = currentCluster.at(-1);
    const gap = differenceInDays(previousEvent.date, event.date);

    if (gap <= ACTIVITY_GAP_DAYS) {
      currentCluster.push(event);
    } else {
      clusters.push([event]);
    }
  });

  return clusters.map((cluster, index) => {
    const actualStart = cluster[0].date;
    const actualEnd = cluster.at(-1).date;
    const total = cluster.reduce((sum, event) => sum + event.cost, 0);
    const purchaseDays = new Set(
      cluster.map((event) => event.date.toISOString().slice(0, 10)),
    ).size;

    const leadDays = clamp(Math.round(Math.log10(total + 1)), 1, 4);
    const trailingDays = clamp(
      Math.ceil(purchaseDays / 2) + Math.floor(total / 2500),
      2,
      9,
    );

    const estimatedStart = addDays(actualStart, -leadDays);
    const estimatedEnd = addDays(actualEnd, trailingDays);
    const actualSpan = differenceInDays(actualStart, actualEnd) + 1;

    let confidence = "Low confidence";
    if (cluster.length >= 5 || (cluster.length >= 3 && actualSpan >= 7)) {
      confidence = "High confidence";
    } else if (cluster.length >= 2) {
      confidence = "Medium confidence";
    }

    return {
      id: `${cluster[0].jobId}-${actualStart.getTime()}-${index}`,
      events: cluster,
      total,
      purchaseDays,
      estimatedStart,
      estimatedEnd,
      estimatedDays: differenceInDays(estimatedStart, estimatedEnd) + 1,
      confidence,
    };
  });
}

function getMonthSegments(timelineStart, timelineEnd) {
  const totalDays = differenceInDays(timelineStart, timelineEnd) + 1;
  const segments = [];
  let cursor = startOfMonth(timelineStart);

  while (cursor <= timelineEnd) {
    const monthStart = cursor < timelineStart ? timelineStart : cursor;
    const naturalEnd = endOfMonth(cursor);
    const monthEnd = naturalEnd > timelineEnd ? timelineEnd : naturalEnd;

    segments.push({
      key: `${cursor.getFullYear()}-${cursor.getMonth()}`,
      date: new Date(cursor),
      left: (differenceInDays(timelineStart, monthStart) / totalDays) * 100,
      width:
        ((differenceInDays(monthStart, monthEnd) + 1) / totalDays) * 100,
    });

    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1, 12);
  }

  return segments;
}

export default function ForecastPage({ jobs: suppliedJobs = [] }) {
  const [jobs, setJobs] = useState(
    Array.isArray(suppliedJobs) ? suppliedJobs : [],
  );
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [range, setRange] = useState("all");
  const [zoom, setZoom] = useState("overview");
  const [sortMode, setSortMode] = useState("recent");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPeriod, setSelectedPeriod] = useState(null);

  useEffect(() => {
    if (Array.isArray(suppliedJobs) && suppliedJobs.length) {
      setJobs(suppliedJobs);
    }
  }, [suppliedJobs]);

  useEffect(() => {
    loadTimelineData();
  }, []);

  useEffect(() => {
    function closeOnEscape(event) {
      if (event.key === "Escape") setSelectedPeriod(null);
    }

    if (selectedPeriod) {
      window.addEventListener("keydown", closeOnEscape);
      document.body.classList.add("forecastModalOpen");
    }

    return () => {
      window.removeEventListener("keydown", closeOnEscape);
      document.body.classList.remove("forecastModalOpen");
    };
  }, [selectedPeriod]);

  async function loadTimelineData() {
    setLoading(true);
    setError("");

    try {
      const filesResponse = await fetch(`${API_BASE}/api/files`);

      if (filesResponse.status === 401) {
        throw new Error("Your session has expired. Refresh and sign in again.");
      }

      if (!filesResponse.ok) {
        throw new Error("Cost records could not be loaded.");
      }

      const fileData = await filesResponse.json();
      setFiles(Array.isArray(fileData) ? fileData : []);

      if (!Array.isArray(suppliedJobs) || suppliedJobs.length === 0) {
        const jobsResponse = await fetch(`${API_BASE}/jobs`);

        if (!jobsResponse.ok) {
          throw new Error("Jobs could not be loaded.");
        }

        const jobData = await jobsResponse.json();
        setJobs(Array.isArray(jobData) ? jobData : []);
      }
    } catch (loadError) {
      console.error("Failed to build job activity timeline:", loadError);
      setError(loadError.message || "The activity timeline could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  const spendEvents = useMemo(() => {
    const events = [];

    files.forEach((file) => {
      const date = parseDate(
        file.purchaseDate || file.dateSorted || file.uploadedAt,
      );

      if (!date) return;

      (Array.isArray(file.links) ? file.links : []).forEach((link) => {
        if (link.targetType !== "job" || !link.targetId) return;

        const cost = Number(link.cost || 0);
        if (!Number.isFinite(cost) || cost <= 0) return;

        events.push({
          id: `${file.id || file.fileName}-${link.targetId}-${events.length}`,
          jobId: String(link.targetId),
          fallbackJobName: link.targetName || "",
          date,
          cost,
          fileName: file.fileName || file.name || "Unnamed file",
          fileUrl: file.url ? `${API_BASE}${file.url}` : "",
          supplier: file.supplier || "Unknown supplier",
          category: link.category || "other",
          tag: link.tag || "",
          note: link.note || "",
        });
      });
    });

    return events.sort((a, b) => a.date - b.date);
  }, [files]);

  const timelineRange = useMemo(() => {
    const now = startOfDay(new Date());

    if (range === "current-year") {
      return {
        start: new Date(now.getFullYear(), 0, 1, 12),
        end: new Date(now.getFullYear(), 11, 31, 12),
      };
    }

    if (range === "last-12-months") {
      return {
        start: addDays(now, -365),
        end: addDays(now, 30),
      };
    }

    if (!spendEvents.length) {
      return {
        start: new Date(now.getFullYear(), 0, 1, 12),
        end: new Date(now.getFullYear(), 11, 31, 12),
      };
    }

    return {
      start: startOfMonth(spendEvents[0].date),
      end: endOfMonth(spendEvents.at(-1).date),
    };
  }, [range, spendEvents]);

  const activityRows = useMemo(() => {
    const jobLookup = new Map(
      jobs.map((job) => [String(job.id), job]),
    );
    const groupedEvents = new Map();

    spendEvents.forEach((event) => {
      if (
        event.date < timelineRange.start ||
        event.date > timelineRange.end
      ) {
        return;
      }

      if (!groupedEvents.has(event.jobId)) {
        groupedEvents.set(event.jobId, []);
      }

      groupedEvents.get(event.jobId).push(event);
    });

    const rows = [...groupedEvents.entries()].map(([jobId, events]) => {
      const job = jobLookup.get(jobId);
      const periods = buildActivityPeriods(events);
      const total = events.reduce((sum, event) => sum + event.cost, 0);

      return {
        jobId,
        job,
        name: getJobName(job, jobId, events[0]?.fallbackJobName),
        colour: getJobColour(job, jobId),
        events,
        periods,
        total,
        firstActivity: events[0].date,
        lastActivity: events.at(-1).date,
      };
    });

    const search = searchTerm.trim().toLowerCase();
    const filteredRows = search
      ? rows.filter((row) => {
          const suppliers = row.events.map((event) => event.supplier).join(" ");
          return `${row.name} ${suppliers}`.toLowerCase().includes(search);
        })
      : rows;

    return filteredRows.sort((a, b) => {
      if (sortMode === "oldest") return a.firstActivity - b.firstActivity;
      if (sortMode === "name") return a.name.localeCompare(b.name);
      if (sortMode === "spend") return b.total - a.total;
      return b.lastActivity - a.lastActivity;
    });
  }, [jobs, searchTerm, sortMode, spendEvents, timelineRange]);

  const allPeriods = activityRows.flatMap((row) => row.periods);
  const visibleEvents = activityRows.flatMap((row) => row.events);
  const totalSpend = visibleEvents.reduce((sum, event) => sum + event.cost, 0);
  const maximumPeriodSpend = Math.max(
    ...allPeriods.map((period) => period.total),
    1,
  );
  const totalDays = differenceInDays(timelineRange.start, timelineRange.end) + 1;
  const pixelsPerDay =
    zoom === "detail" ? 8 : zoom === "standard" ? 4 : 2;
  const timelineWidth = Math.max(920, Math.round(totalDays * pixelsPerDay));
  const monthSegments = getMonthSegments(
    timelineRange.start,
    timelineRange.end,
  );
  const currentDate = startOfDay(new Date());
  const currentDateVisible =
    currentDate >= timelineRange.start && currentDate <= timelineRange.end;
  const currentDateLeft =
    (differenceInDays(timelineRange.start, currentDate) / totalDays) * 100;

  function leftPosition(date) {
    return clamp(
      (differenceInDays(timelineRange.start, date) / totalDays) * 100,
      0,
      100,
    );
  }

  function periodWidth(period) {
    const visibleStart =
      period.estimatedStart < timelineRange.start
        ? timelineRange.start
        : period.estimatedStart;
    const visibleEnd =
      period.estimatedEnd > timelineRange.end
        ? timelineRange.end
        : period.estimatedEnd;

    return Math.max(
      ((differenceInDays(visibleStart, visibleEnd) + 1) / totalDays) * 100,
      0.35,
    );
  }

  function openPeriod(row, period) {
    setSelectedPeriod({ row, period });
  }

  return (
    <div className="forecast-page">
      <header className="forecast-header">
        <div>
          <span className="forecast-eyebrow">JNR job history</span>
          <h1>Job Activity Timeline</h1>
          <p>
            Estimated working periods built from the timing, frequency and
            value of job-linked spending.
          </p>
        </div>

        <button
          type="button"
          className="forecast-button forecast-button-primary"
          onClick={loadTimelineData}
          disabled={loading}
        >
          {loading ? "Refreshing…" : "Refresh activity"}
        </button>
      </header>

      {error && <div className="forecast-error">{error}</div>}

      <section className="forecast-summary-grid">
        <div>
          <span>Jobs detected</span>
          <strong>{activityRows.length}</strong>
        </div>
        <div>
          <span>Inferred periods</span>
          <strong>{allPeriods.length}</strong>
        </div>
        <div>
          <span>Spend points</span>
          <strong>{visibleEvents.length}</strong>
        </div>
        <div>
          <span>Allocated spend</span>
          <strong>{money(totalSpend)}</strong>
        </div>
      </section>

      <section className="forecast-toolbar">
        <div className="forecast-field forecast-search-field">
          <label>Search</label>
          <input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search job or supplier…"
          />
        </div>

        <div className="forecast-field">
          <label>Period</label>
          <select value={range} onChange={(event) => setRange(event.target.value)}>
            <option value="all">All recorded activity</option>
            <option value="last-12-months">Last 12 months</option>
            <option value="current-year">Current year</option>
          </select>
        </div>

        <div className="forecast-field">
          <label>Sort jobs</label>
          <select
            value={sortMode}
            onChange={(event) => setSortMode(event.target.value)}
          >
            <option value="recent">Most recent first</option>
            <option value="oldest">Oldest first</option>
            <option value="name">Job name</option>
            <option value="spend">Highest spend</option>
          </select>
        </div>

        <div className="forecast-zoom-control">
          <span>Timeline scale</span>
          <div>
            {[
              ["overview", "Overview"],
              ["standard", "Standard"],
              ["detail", "Detail"],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={zoom === value ? "active" : ""}
                onClick={() => setZoom(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <div className="forecast-method-note">
        <span>Estimated view</span>
        Spending more than {ACTIVITY_GAP_DAYS} days apart starts a new activity
        period. Larger and more frequent spending creates a stronger activity
        signal. This is not a confirmed attendance record.
      </div>

      <section className="timeline-panel">
        {loading ? (
          <div className="timeline-empty-state">
            <span className="timeline-loader" />
            <h2>Building the timeline</h2>
            <p>Reading job-linked cost records…</p>
          </div>
        ) : activityRows.length === 0 ? (
          <div className="timeline-empty-state">
            <span>—</span>
            <h2>No job activity found</h2>
            <p>
              Add costs to files and link them to jobs to build this timeline.
            </p>
          </div>
        ) : (
          <div className="timeline-scroll">
            <div
              className="timeline-content"
              style={{
                gridTemplateColumns: `var(--timeline-label-width) ${timelineWidth}px`,
              }}
            >
              <div className="timeline-ruler-corner">
                <span>Job</span>
                <strong>{activityRows.length} visible</strong>
              </div>

              <div className="timeline-ruler" style={{ width: timelineWidth }}>
                {monthSegments.map((month) => (
                  <div
                    key={month.key}
                    className="timeline-month-label"
                    style={{ left: `${month.left}%`, width: `${month.width}%` }}
                    title={month.date.toLocaleDateString("en-GB", {
                      month: "long",
                      year: "numeric",
                    })}
                  >
                    {formatMonth(month.date)}
                  </div>
                ))}
              </div>

              {activityRows.map((row) => (
                <div className="timeline-row" key={row.jobId}>
                  <div className="timeline-job-cell">
                    <span
                      className="timeline-job-colour"
                      style={{ background: row.colour }}
                    />

                    <div>
                      <strong title={row.name}>{row.name}</strong>
                      <span>
                        {money(row.total)} · {row.events.length}{" "}
                        {row.events.length === 1 ? "cost" : "costs"}
                      </span>
                    </div>
                  </div>

                  <div className="timeline-track" style={{ width: timelineWidth }}>
                    {monthSegments.map((month) => (
                      <span
                        key={month.key}
                        className="timeline-month-grid"
                        style={{ left: `${month.left}%`, width: `${month.width}%` }}
                      />
                    ))}

                    {currentDateVisible && (
                      <span
                        className="timeline-today-line"
                        style={{ left: `${currentDateLeft}%` }}
                      />
                    )}

                    {row.periods.map((period) => {
                      const periodStart =
                        period.estimatedStart < timelineRange.start
                          ? timelineRange.start
                          : period.estimatedStart;
                      const intensity =
                        0.3 + (period.total / maximumPeriodSpend) * 0.45;

                      return (
                        <button
                          key={period.id}
                          type="button"
                          className="timeline-activity-bar"
                          style={{
                            left: `${leftPosition(periodStart)}%`,
                            width: `${periodWidth(period)}%`,
                            color: row.colour,
                            borderColor: row.colour,
                            background: hexToRgba(row.colour, intensity),
                          }}
                          onClick={() => openPeriod(row, period)}
                          title={`${row.name}\n${formatDate(
                            period.estimatedStart,
                          )} – ${formatDate(period.estimatedEnd)}\n${money(
                            period.total,
                          )} across ${period.events.length} cost records`}
                        >
                          <span>{money(period.total)}</span>
                        </button>
                      );
                    })}

                    {row.events.map((event) => {
                      const dotSize = clamp(
                        6 + Math.sqrt(event.cost) / 7,
                        7,
                        16,
                      );

                      return (
                        <button
                          key={event.id}
                          type="button"
                          className="timeline-spend-dot"
                          style={{
                            left: `${leftPosition(event.date)}%`,
                            width: `${dotSize}px`,
                            height: `${dotSize}px`,
                            background: row.colour,
                          }}
                          onClick={() => {
                            const period = row.periods.find((item) =>
                              item.events.some(
                                (periodEvent) => periodEvent.id === event.id,
                              ),
                            );
                            if (period) openPeriod(row, period);
                          }}
                          title={`${formatDate(event.date)} · ${event.supplier} · ${money(
                            event.cost,
                          )}`}
                          aria-label={`Open ${row.name} activity for ${formatDate(
                            event.date,
                          )}`}
                        />
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      <div className="timeline-legend">
        <span><i className="legend-bar" /> Inferred working period</span>
        <span><i className="legend-dot" /> Individual spend date</span>
        <span><i className="legend-today" /> Today</span>
      </div>

      {selectedPeriod && (
        <div
          className="activity-modal-backdrop"
          onClick={() => setSelectedPeriod(null)}
        >
          <section
            className="activity-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div
              className="activity-modal-colour"
              style={{ background: selectedPeriod.row.colour }}
            />

            <header className="activity-modal-header">
              <div>
                <span>Inferred activity period</span>
                <h2>{selectedPeriod.row.name}</h2>
                <p>
                  {formatDate(selectedPeriod.period.estimatedStart)} –{" "}
                  {formatDate(selectedPeriod.period.estimatedEnd)}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSelectedPeriod(null)}
                aria-label="Close activity details"
              >
                ×
              </button>
            </header>

            <div className="activity-modal-summary">
              <div>
                <span>Estimated duration</span>
                <strong>{selectedPeriod.period.estimatedDays} days</strong>
              </div>
              <div>
                <span>Allocated spend</span>
                <strong>{money(selectedPeriod.period.total)}</strong>
              </div>
              <div>
                <span>Cost records</span>
                <strong>{selectedPeriod.period.events.length}</strong>
              </div>
              <div>
                <span>Signal</span>
                <strong>{selectedPeriod.period.confidence}</strong>
              </div>
            </div>

            <div className="activity-file-list">
              <div className="activity-file-list-header">
                <h3>Spend behind this estimate</h3>
                <span>{selectedPeriod.period.purchaseDays} purchase days</span>
              </div>

              {[...selectedPeriod.period.events]
                .sort((a, b) => b.date - a.date)
                .map((event) => (
                  <div className="activity-file-row" key={event.id}>
                    <div className="activity-file-date">
                      <strong>{event.date.getDate()}</strong>
                      <span>{formatMonth(event.date, false)}</span>
                    </div>

                    <div className="activity-file-copy">
                      <strong>{event.supplier}</strong>
                      <span title={event.fileName}>{event.fileName}</span>
                      {(event.tag || event.category) && (
                        <small>{event.tag || event.category}</small>
                      )}
                    </div>

                    <strong className="activity-file-cost">
                      {money(event.cost)}
                    </strong>

                    {event.fileUrl && (
                      <a href={event.fileUrl} target="_blank" rel="noreferrer">
                        Open file
                      </a>
                    )}
                  </div>
                ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
