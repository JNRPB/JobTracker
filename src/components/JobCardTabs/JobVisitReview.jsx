import { useEffect, useState } from "react";

const API_BASE = "http://192.168.0.22:3001";

function formatTime(value) {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatMinutes(mins) {
  const m = Math.round(Number(mins || 0));
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return h ? `${h}h ${rem}m` : `${m}m`;
}

export default function JobVisitReview({ jobId, navigate }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  async function loadVisits() {
    setLoading(true);

    try {
      const res = await fetch(
        `${API_BASE}/api/jobs/${jobId}/potential-visits?source=combined&days=365&deviceId=1`,
      );

      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error(err);
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadVisits();
  }, [jobId]);

  return (
    <div className="reviewPage">
      <style>{`
        .reviewPage {
          padding: 22px;
          color: #f8fafc;
          background: #020617;
          min-height: 100vh;
        }

        .top {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 18px;
        }

        .card {
          background: linear-gradient(180deg, rgba(15,23,42,.95), rgba(2,6,23,.95));
          border: 1px solid rgba(148,163,184,.16);
          border-radius: 18px;
          padding: 18px;
          margin-bottom: 12px;
        }

        .muted {
          color: #94a3b8;
          font-size: 13px;
        }

        button {
          border-radius: 12px;
          padding: 10px 14px;
          border: 1px solid rgba(255,255,255,.12);
          background: rgba(255,255,255,.06);
          color: white;
          cursor: pointer;
          font-weight: 800;
        }

        .primary {
          background: linear-gradient(135deg, #22c55e, #16a34a);
          border: none;
        }

        .visit {
          display: grid;
          grid-template-columns: 120px 1fr auto;
          gap: 14px;
          align-items: center;
        }

        .badge {
          color: #facc15;
          font-weight: 900;
        }
      `}</style>

      <div className="top">
        <div>
          <button onClick={() => navigate("JobOverview", { jobId })}>
            ← Back to Job
          </button>
          <h1>Review Potential Visits</h1>
          <div className="muted">{data?.jobName || `Job ${jobId}`}</div>
        </div>

        <button className="primary" onClick={loadVisits}>
          Refresh
        </button>
      </div>

      <div className="card">
        <h2>
          {loading ? "Scanning…" : `${data?.potential || 0} potential visits`}
        </h2>
        <div className="muted">
          {data?.visitDays || 0} visit day(s) checked across{" "}
          {data?.daysChecked || 365} days
        </div>
      </div>

      {data?.visits?.map((day) => (
        <div key={day.date} className="card visit">
          <div>
            <strong>{day.date}</strong>
            <div className="muted">{day.visitCount} visit(s)</div>
          </div>

          <div>
            <div className="badge">
              {formatMinutes(day.totalMinutes)} detected
            </div>
            {day.stops?.map((stop, index) => (
              <div key={index} className="muted">
                {formatTime(stop.startTime)} → {formatTime(stop.endTime)} ·{" "}
                {Math.round(stop.closestDistanceMeters || 0)}m from pin ·{" "}
                {stop.matchType}
              </div>
            ))}
          </div>

          <button className="primary">Confirm</button>
        </div>
      ))}

      {!loading && !data?.visits?.length && (
        <div className="card muted">No potential visits found.</div>
      )}
    </div>
  );
}
