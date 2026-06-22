import { useEffect, useMemo, useState } from "react";

const API_BASE = "http://192.168.0.22:3001";

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const TAG_DEFAULTS = {
  Materials: true,
  Tools: true,
  Fuel: true,
  "PPE / Workwear": true,
  "Waste Removal": true,
  "Office / Admin": true,
  Advertising: true,
  "Van Maintenance": true,
  Labour: false,
  Untagged: true,
};

const TAG_COLOURS = {
  Materials: "#38bdf8",
  Tools: "#a78bfa",
  Fuel: "#f97316",
  "PPE / Workwear": "#22d3ee",
  "Waste Removal": "#facc15",
  "Office / Admin": "#22c55e",
  Advertising: "#ec4899",
  "Van Maintenance": "#0ea5e9",
  Labour: "#ef4444",
  Untagged: "#94a3b8",
};

const JOB_COLOURS = [
  "#f97316",
  "#38bdf8",
  "#22c55e",
  "#a78bfa",
  "#ef4444",
  "#eab308",
  "#14b8a6",
];

function SpendCalendar({ jobs = [] }) {
  const [files, setFiles] = useState([]);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [visibleTags, setVisibleTags] = useState(TAG_DEFAULTS);
  const [viewMode, setViewMode] = useState("subway");
  const [hoveredJobId, setHoveredJobId] = useState(null);
  const [hoveredPoint, setHoveredPoint] = useState(null);
  const [selectedDay, setSelectedDay] = useState(null);
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    fetchFiles();
  }, []);

  async function fetchFiles() {
    try {
      const res = await fetch(`${API_BASE}/api/files`);
      const data = await res.json();
      setFiles(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to fetch files:", err);
    }
  }

  function getDateKey(dateString) {
    if (!dateString) return null;
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return null;
    return date.toISOString().slice(0, 10);
  }

  function getDayOfYear(dateKey) {
    const date = new Date(`${dateKey}T00:00:00`);
    const start = new Date(date.getFullYear(), 0, 0);
    return Math.floor((date - start) / 86400000);
  }

  function getYearDays(year) {
    return new Date(year, 1, 29).getMonth() === 1 ? 366 : 365;
  }

  function getJobName(jobId) {
    if (jobId === "no-job") return "No Job Link";
    const job = jobs.find((item) => String(item.id) === String(jobId));
    return job?.name || job?.address || `Job ${jobId}`;
  }

  function getLinkJobId(link) {
    return link.targetType === "job" ? String(link.targetId) : "no-job";
  }

  const years = useMemo(() => {
    const found = new Set();

    files.forEach((file) => {
      const key = getDateKey(file.purchaseDate || file.dateSorted);
      if (key) found.add(Number(key.slice(0, 4)));
    });

    found.add(new Date().getFullYear());

    return Array.from(found).sort((a, b) => b - a);
  }, [files]);

  const tagOptions = useMemo(() => {
    const tags = new Set(Object.keys(TAG_DEFAULTS));

    files.forEach((file) => {
      const links = Array.isArray(file.links) ? file.links : [];
      links.forEach((link) => tags.add(link.tag || "Untagged"));
    });

    return Array.from(tags);
  }, [files]);

  const allSpendItems = useMemo(() => {
    const items = [];

    files.forEach((file) => {
      const dateKey = getDateKey(file.purchaseDate || file.dateSorted);
      if (!dateKey) return;
      if (Number(dateKey.slice(0, 4)) !== Number(selectedYear)) return;

      const links = Array.isArray(file.links) ? file.links : [];

      links.forEach((link, index) => {
        const cost = Number(link.cost || 0);
        if (!cost) return;

        const tag = link.tag || "Untagged";
        const jobId = getLinkJobId(link);

        items.push({
          id: `${file.id}-${index}`,
          dateKey,
          dayOfYear: getDayOfYear(dateKey),
          fileName: file.fileName || file.name || "Unnamed file",
          supplier: file.supplier || "No supplier",
          jobId,
          jobName: link.targetName || getJobName(jobId),
          tag,
          fileType: link.category || "other",
          cost,
          note: link.note || "",
          url: file.url ? `${API_BASE}${file.url}` : "",
        });
      });
    });

    return items;
  }, [files, jobs, selectedYear]);

  const spendItems = useMemo(() => {
    return allSpendItems.filter((item) => visibleTags[item.tag] !== false);
  }, [allSpendItems, visibleTags]);

  const yearDays = getYearDays(selectedYear);
  const maxSpend = Math.max(...spendItems.map((item) => item.cost), 1);
  const visibleTotal = spendItems.reduce((sum, item) => sum + item.cost, 0);

  const today = new Date();
  const todayKey = today.toISOString().slice(0, 10);
  const showToday = Number(todayKey.slice(0, 4)) === Number(selectedYear);
  const todayLeft = showToday ? (getDayOfYear(todayKey) / yearDays) * 100 : 0;

  const jobColourMap = useMemo(() => {
    const ids = [];

    spendItems.forEach((item) => {
      if (!ids.includes(item.jobId)) ids.push(item.jobId);
    });

    return ids.reduce((acc, id, index) => {
      acc[id] = JOB_COLOURS[index % JOB_COLOURS.length];
      return acc;
    }, {});
  }, [spendItems]);

  const spendByDay = useMemo(() => {
    const map = {};

    spendItems.forEach((item) => {
      if (!map[item.dateKey]) {
        map[item.dateKey] = {
          dateKey: item.dateKey,
          total: 0,
          items: [],
        };
      }

      map[item.dateKey].total += item.cost;
      map[item.dateKey].items.push(item);
    });

    return map;
  }, [spendItems]);

  const jobTimelines = useMemo(() => {
    const map = {};

    spendItems.forEach((item) => {
      if (!map[item.jobId]) {
        map[item.jobId] = {
          jobId: item.jobId,
          jobName: item.jobName || getJobName(item.jobId),
          colour: jobColourMap[item.jobId],
          total: 0,
          items: [],
        };
      }

      map[item.jobId].items.push(item);
      map[item.jobId].total += item.cost;
    });

    return Object.values(map)
      .map((job) => {
        const sorted = [...job.items].sort((a, b) =>
          a.dateKey.localeCompare(b.dateKey),
        );

        return {
          ...job,
          items: sorted,
          startDay: sorted[0]?.dayOfYear || 1,
          endDay: sorted[sorted.length - 1]?.dayOfYear || 1,
          startDate: sorted[0]?.dateKey,
          endDate: sorted[sorted.length - 1]?.dateKey,
        };
      })
      .sort((a, b) => a.startDay - b.startDay);
  }, [spendItems, jobColourMap]);

  const tagTotals = useMemo(() => {
    const totals = {};

    allSpendItems.forEach((item) => {
      totals[item.tag] = (totals[item.tag] || 0) + item.cost;
    });

    return totals;
  }, [allSpendItems]);

  const tagTimelines = useMemo(() => {
    const map = {};

    spendItems.forEach((item) => {
      if (!map[item.tag]) {
        map[item.tag] = {
          tag: item.tag,
          total: 0,
          items: [],
        };
      }

      map[item.tag].items.push(item);
      map[item.tag].total += item.cost;
    });

    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [spendItems]);

  function getLeft(day) {
    return `${(day / yearDays) * 100}%`;
  }

  function getPointSize(cost) {
    const ratio = cost / maxSpend;
    if (ratio > 0.75) return 20;
    if (ratio > 0.45) return 16;
    if (ratio > 0.2) return 12;
    return 8;
  }

  function getDimClass(jobId) {
    if (!hoveredJobId) return "";
    return hoveredJobId === jobId ? "is-focused" : "is-dimmed";
  }

  function toggleTag(tag) {
    setVisibleTags((current) => ({
      ...current,
      [tag]: current[tag] === false,
    }));
  }

  function onlyTag(tag) {
    const next = {};
    tagOptions.forEach((item) => {
      next[item] = item === tag;
    });
    setVisibleTags(next);
    setSelectedDay(null);
  }

  function showAllTags() {
    const next = {};
    tagOptions.forEach((tag) => {
      next[tag] = true;
    });
    setVisibleTags(next);
  }

  function hideLabour() {
    setVisibleTags((current) => ({
      ...current,
      Labour: false,
    }));
  }

  function goToday() {
    setSelectedYear(new Date().getFullYear());
  }

  function showHover(e, item, subtitle) {
    const rect = e.currentTarget.getBoundingClientRect();

    setHoveredPoint({
      left: rect.left + rect.width / 2,
      top: rect.top - 14,
      title: item.dateKey,
      subtitle,
      cost: item.cost,
      note: item.note,
    });
  }

  function renderHoverBubble() {
    if (!hoveredPoint) return null;

    return (
      <div
        className="timeline-hover-bubble"
        style={{
          left: hoveredPoint.left,
          top: hoveredPoint.top,
        }}
      >
        <strong>{hoveredPoint.title}</strong>
        <p>{hoveredPoint.subtitle}</p>
        <p className="timeline-hover-money">£{hoveredPoint.cost.toFixed(2)}</p>
        {hoveredPoint.note && <p className="soft-text">{hoveredPoint.note}</p>}
      </div>
    );
  }

  function renderTimelineHeader() {
    return (
      <div className="timeline-axis">
        <span className="timeline-year-label">{selectedYear}</span>

        <div className="timeline-months">
          {MONTHS.map((month, index) => (
            <div key={month} className="timeline-month">
              <strong>{month}</strong>
              <span>1</span>
              <span>15</span>
            </div>
          ))}

          {showToday && (
            <div
              className="timeline-today-marker"
              style={{ left: `${todayLeft}%` }}
            >
              <span>TODAY</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  function renderSubwayView() {
    const minWidth = 900 * zoom;

    return (
      <div className="subway-card">
        {renderTimelineHeader()}

        <div className="subway-body">
          {jobTimelines.map((job) => {
            const start = (job.startDay / yearDays) * 100;
            const width = Math.max(
              ((job.endDay - job.startDay) / yearDays) * 100,
              1,
            );

            return (
              <div
                className={`subway-row ${getDimClass(job.jobId)}`}
                key={job.jobId}
                onMouseEnter={() => setHoveredJobId(job.jobId)}
                onMouseLeave={() => {
                  setHoveredJobId(null);
                  setHoveredPoint(null);
                }}
              >
                <div className="subway-label">
                  <span
                    className="subway-label-dot"
                    style={{
                      backgroundColor: job.colour,
                      boxShadow: `0 0 16px ${job.colour}`,
                    }}
                  />
                  <div>
                    <strong>{job.jobName}</strong>
                    <p>
                      Day {job.startDay} → {job.endDay}
                    </p>
                    <p>£{job.total.toFixed(0)}</p>
                  </div>
                </div>

                <div className="subway-track-scroll">
                  <div className="subway-track" style={{ minWidth }}>
                    <div
                      className="subway-line"
                      style={{
                        left: `${start}%`,
                        width: `${width}%`,
                        backgroundColor: job.colour,
                        boxShadow:
                          hoveredJobId === job.jobId
                            ? `0 0 22px ${job.colour}`
                            : `0 0 9px ${job.colour}`,
                      }}
                    />

                    {showToday && (
                      <span
                        className="timeline-current-line"
                        style={{ left: `${todayLeft}%` }}
                      />
                    )}

                    {job.items.map((item) => {
                      const size = getPointSize(item.cost);

                      return (
                        <button
                          type="button"
                          key={item.id}
                          className="subway-dot"
                          style={{
                            left: getLeft(item.dayOfYear),
                            width: size,
                            height: size,
                            backgroundColor: job.colour,
                            boxShadow: `0 0 ${size + 12}px ${job.colour}`,
                          }}
                          onMouseEnter={(e) =>
                            showHover(e, item, `${item.supplier} · ${item.tag}`)
                          }
                          onMouseLeave={() => setHoveredPoint(null)}
                          onClick={() =>
                            setSelectedDay(spendByDay[item.dateKey])
                          }
                        />
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="timeline-legend">
          <span>Key</span>
          <span className="legend-dot small" /> £0 - £50
          <span className="legend-dot medium" /> £51 - £150
          <span className="legend-dot large" /> £151 - £500
          <span className="legend-dot huge" /> £501+
          <span className="legend-line" /> Project lifespan
          <span className="legend-today" /> Today
        </div>
      </div>
    );
  }

  function renderTagsView() {
    return (
      <div className="subway-card">
        {renderTimelineHeader()}

        <div className="subway-body">
          {tagTimelines.map((tagRow) => {
            const colour = TAG_COLOURS[tagRow.tag] || "#94a3b8";

            return (
              <div className="subway-row" key={tagRow.tag}>
                <div className="subway-label">
                  <span
                    className="subway-label-dot"
                    style={{
                      backgroundColor: colour,
                      boxShadow: `0 0 16px ${colour}`,
                    }}
                  />
                  <div>
                    <strong>{tagRow.tag}</strong>
                    <p>£{tagRow.total.toFixed(0)}</p>
                  </div>
                </div>

                <div className="subway-track-scroll">
                  <div
                    className="subway-track"
                    style={{ minWidth: 900 * zoom }}
                  >
                    {showToday && (
                      <span
                        className="timeline-current-line"
                        style={{ left: `${todayLeft}%` }}
                      />
                    )}

                    {tagRow.items.map((item) => {
                      const size = getPointSize(item.cost);

                      return (
                        <button
                          type="button"
                          key={item.id}
                          className="subway-dot"
                          style={{
                            left: getLeft(item.dayOfYear),
                            width: size,
                            height: size,
                            backgroundColor: colour,
                            boxShadow: `0 0 ${size + 12}px ${colour}`,
                          }}
                          onMouseEnter={(e) =>
                            showHover(
                              e,
                              item,
                              `${item.supplier} · ${item.jobName}`,
                            )
                          }
                          onMouseLeave={() => setHoveredPoint(null)}
                          onClick={() =>
                            setSelectedDay(spendByDay[item.dateKey])
                          }
                        />
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  function renderDaysView() {
    return (
      <div className="mini-calendar-grid">
        {Object.values(spendByDay)
          .sort((a, b) => a.dateKey.localeCompare(b.dateKey))
          .map((day) => (
            <button
              key={day.dateKey}
              type="button"
              className="mini-calendar-day"
              onClick={() => setSelectedDay(day)}
            >
              <strong>{day.dateKey}</strong>
              <span>£{day.total.toFixed(2)}</span>
              <small>{day.items.length} entries</small>
            </button>
          ))}
      </div>
    );
  }

  return (
    <div className="widget spend-calendar-page">
      {renderHoverBubble()}

      <div className="spend-top-row">
        <div>
          <h2>Spend Timeline</h2>
          <p className="soft-text">
            See when and where money was spent across all projects.
          </p>
        </div>

        <div className="year-pill">
          <span>📅</span>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
          >
            {years.map((year) => (
              <option key={year}>{year}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="spend-dashboard-grid">
        <section className="spend-layer-panel">
          <div className="spend-layer-header">
            <div>
              <h3>Spend Layers</h3>
              <p className="soft-text">
                Labour is hidden by default so it does not dominate the
                timeline.
              </p>
            </div>

            <div className="spend-layer-actions">
              <button type="button" onClick={showAllTags}>
                Show All
              </button>
              <button type="button" onClick={hideLabour}>
                Hide Labour
              </button>
            </div>
          </div>

          <div className="spend-layer-grid">
            {tagOptions.map((tag) => {
              const visible = visibleTags[tag] !== false;
              const colour = TAG_COLOURS[tag] || "#94a3b8";

              return (
                <div
                  key={tag}
                  className={`spend-layer-card ${visible ? "active" : "muted"}`}
                >
                  <button type="button" onClick={() => toggleTag(tag)}>
                    <span
                      className="layer-colour-dot"
                      style={{ backgroundColor: colour }}
                    />
                    <strong>{tag}</strong>
                  </button>

                  <span>£{Number(tagTotals[tag] || 0).toFixed(0)}</span>

                  <button
                    type="button"
                    className="layer-only-button"
                    onClick={() => onlyTag(tag)}
                  >
                    Only
                  </button>
                </div>
              );
            })}
          </div>
        </section>

        <section className="visible-spend-card">
          <p>Visible Spend ({selectedYear})</p>
          <strong>£{visibleTotal.toFixed(0)}</strong>

          <div className="visible-spend-mini">
            <div>
              <span>Days</span>
              <b>{Object.keys(spendByDay).length}</b>
            </div>
            <div>
              <span>Entries</span>
              <b>{spendItems.length}</b>
            </div>
            <div>
              <span>Avg/day</span>
              <b>
                £
                {Object.keys(spendByDay).length
                  ? (visibleTotal / Object.keys(spendByDay).length).toFixed(0)
                  : "0"}
              </b>
            </div>
          </div>
        </section>
      </div>

      <div className="timeline-toolbar">
        <div className="timeline-tabs">
          <button
            className={viewMode === "subway" ? "active" : ""}
            onClick={() => setViewMode("subway")}
          >
            # Subway View
          </button>
          <button
            className={viewMode === "tags" ? "active" : ""}
            onClick={() => setViewMode("tags")}
          >
            🏷 Tags View
          </button>
          <button
            className={viewMode === "days" ? "active" : ""}
            onClick={() => setViewMode("days")}
          >
            🗓 Days View
          </button>
        </div>

        <div className="timeline-zoom">
          <span>Zoom</span>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(0.7, z - 0.15))}
          >
            −
          </button>
          <strong>{Math.round(zoom * 100)}%</strong>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(1.8, z + 0.15))}
          >
            +
          </button>
          <button type="button" onClick={goToday}>
            Today
          </button>
        </div>
      </div>

      <div className="spend-calendar-layout">
        <div>
          {viewMode === "subway" && renderSubwayView()}
          {viewMode === "tags" && renderTagsView()}
          {viewMode === "days" && renderDaysView()}
        </div>

        <aside className="spend-side-panel">
          <div className="spend-key-panel">
            <h3>
              Job Key <span>(hover to highlight)</span>
            </h3>

            {jobTimelines.map((job) => (
              <div
                key={job.jobId}
                className={`spend-key-row ${getDimClass(job.jobId)}`}
                onMouseEnter={() => setHoveredJobId(job.jobId)}
                onMouseLeave={() => setHoveredJobId(null)}
              >
                <span
                  className="spend-key-colour"
                  style={{
                    backgroundColor: job.colour,
                    boxShadow: `0 0 16px ${job.colour}`,
                  }}
                />

                <div>
                  <strong>{job.jobName}</strong>
                  <p className="soft-text">
                    Day {job.startDay} → {job.endDay} · £{job.total.toFixed(0)}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="spend-day-detail-panel">
            <h3>{selectedDay ? selectedDay.dateKey : "Select a dot"}</h3>

            {!selectedDay ? (
              <p className="soft-text">
                Click any dot on the timeline to inspect that day.
              </p>
            ) : (
              <>
                <strong className="spend-day-total">
                  £{selectedDay.total.toFixed(2)}
                </strong>

                <div className="spend-day-items">
                  {selectedDay.items.map((item) => (
                    <div className="spend-day-item" key={item.id}>
                      <div>
                        <strong>{item.supplier}</strong>
                        <p>{item.jobName}</p>
                        <p className="soft-text">
                          {item.tag} · {item.fileType}
                        </p>
                        {item.note && <p className="soft-text">{item.note}</p>}
                      </div>

                      <div className="spend-day-item-right">
                        <strong>£{item.cost.toFixed(2)}</strong>

                        {item.url && (
                          <a href={item.url} target="_blank" rel="noreferrer">
                            Open
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

export default SpendCalendar;
